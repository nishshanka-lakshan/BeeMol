/* BeeMol extracted JavaScript: assets/js/waterbox.js */

let waterBoxViewer = null;

let waterBoxXYZ = null;

const wb = id => document.getElementById(id);

function wbParseXYZ(input, label) {

  const lines = String(input).replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  let rows = lines.filter(line => line.trim());
  if (/^\d+$/.test((rows[0] || '').trim())) {
    const count = Number(rows.shift().trim());
    // Retain coordinates when an XYZ comment is empty; skip a non-coordinate title.
    if (rows.length && !/^\s*[A-Za-z]{1,3}\s+[-+\d.]/.test(rows[0])) rows.shift();
    if (rows.length !== count) {
      throw Error(`${label}: expected ${count} atoms, found ${rows.length}.`);
    }
  }

  if (!rows.length) {

    throw Error(`${label}: add atom coordinates.`);

  }

  return rows.map((row, i) => {

    const fields = row.trim().split(/\s+/);

    const elem = fields[0].charAt(0).toUpperCase()

      + fields[0].slice(1).toLowerCase();

    const position = fields.slice(1, 4).map(Number);

    if (

      !/^[A-Z][a-z]?$/.test(elem) ||

      fields.length < 4 ||

      position.some(n => !Number.isFinite(n))

    ) {

      throw Error(`${label}: invalid atom on line ${i + 1}.`);

    }

    return {elem, p: position};

  });

}

function wbText(atoms, title) {

  return `${atoms.length}\n${title}\n`

    + atoms.map(atom =>

        `${atom.elem} ${atom.p.map(v => v.toFixed(6)).join(" ")}`

      ).join("\n")

    + "\n";

}

function wbRandomRotation() {

  const a = Math.random() * 2 * Math.PI;

  const b = Math.random() * 2 * Math.PI;

  const c = Math.random();

  const q = [

    Math.sqrt(1 - c) * Math.sin(a),

    Math.sqrt(1 - c) * Math.cos(a),

    Math.sqrt(c) * Math.sin(b),

    Math.sqrt(c) * Math.cos(b)

  ];

  const [x, y, z, w] = q;

  return p => [

    (1 - 2 * (y*y + z*z)) * p[0]

      + 2 * (x*y - z*w) * p[1]

      + 2 * (x*z + y*w) * p[2],

    2 * (x*y + z*w) * p[0]

      + (1 - 2 * (x*x + z*z)) * p[1]

      + 2 * (y*z - x*w) * p[2],

    2 * (x*z - y*w) * p[0]

      + 2 * (y*z + x*w) * p[1]

      + (1 - 2 * (x*x + y*y)) * p[2]

  ];

}

function wbEdges(lengths) {

  for (let axis = 0; axis < 3; axis++) {

    for (let u = 0; u < 2; u++) {

      for (let v = 0; v < 2; v++) {

        const start = [0, 0, 0];

        const end = [0, 0, 0];

        const other = [0, 1, 2].filter(i => i !== axis);

        start[other[0]] = end[other[0]] = u * lengths[other[0]];

        start[other[1]] = end[other[1]] = v * lengths[other[1]];

        end[axis] = lengths[axis];

        waterBoxViewer.addLine({

          start: {x:start[0], y:start[1], z:start[2]},

          end: {x:end[0], y:end[1], z:end[2]},

          color: "#7890a8",

          opacity: 0.8

        });

      }

    }

  }

}

async function generateWaterBox() {

  const status = wb("wbStatus");

  waterBoxXYZ = null;

  wb("wbDownload").disabled = true;

  wb("wbDownloadPDB").disabled = true;

  status.textContent = "Generating water box…";
  wb("wbGenerate").disabled = true;

  try {

    const solute = wbParseXYZ(wb("wbSolute").value, "Molecule");

    const water = wbParseXYZ(wb("wbWater").value, "Water");

    if (

      water.length !== 3 ||

      water.filter(a => a.elem === "O").length !== 1 ||

      water.filter(a => a.elem === "H").length !== 2

    ) {

      throw Error("Water must contain one O and two H atoms.");

    }

    const lengths = ["wbX", "wbY", "wbZ"]

      .map(id => Number(wb(id).value));

    const count = Number(wb("wbCount").value);

    if (lengths.some(v => !Number.isFinite(v) || v < 6 || v > 150)) {

      throw Error("Box lengths must be from 6 to 150 Å.");

    }

    if (!Number.isInteger(count) || count < 0 || count > 800) {

      throw Error("Water count must be from 0 to 800.");

    }

    // Put the midpoint of HCCI's bounds at the center of the box.

    const midpoint = [0, 1, 2].map(k =>

      (

        Math.min(...solute.map(a => a.p[k])) +

        Math.max(...solute.map(a => a.p[k]))

      ) / 2

    );

    const centered = solute.map(atom => ({

      elem: atom.elem,

      p: atom.p.map((value, k) =>

        value - midpoint[k] + lengths[k] / 2

      )

    }));

    if (

      centered.some(atom =>

        atom.p.some((value, k) =>

          value < 1 || value > lengths[k] - 1

        )

      )

    ) {

      throw Error("The molecule does not fit inside this box with a 1 Å margin.");

    }

    // Keep the supplied water bond lengths and angle unchanged.

    const oxygen = water.find(atom => atom.elem === "O").p;

    const rigid = water.map(atom => ({

      elem: atom.elem,

      p: atom.p.map((value, k) => value - oxygen[k])

    }));

    const waters = [];

    const oxygens = [];

    let attempts = 0;

    const distance2 = (p, q) =>

      p.reduce((total, value, k) =>

        total + (value - q[k]) ** 2, 0

      );

    while (

      waters.length < count &&

      attempts < Math.max(2000, count * 130)

    ) {

      attempts++;

      const position = lengths.map(length =>

        1.1 + Math.random() * (length - 2.2)

      );

      const rotate = wbRandomRotation();

      const candidate = rigid.map(atom => ({

        elem: atom.elem,

        p: rotate(atom.p).map((value, k) =>

          value + position[k]

        )

      }));

      if (

        candidate.some(atom =>

          atom.p.some((value, k) =>

            value < 0.4 || value > lengths[k] - 0.4

          )

        )

      ) continue;

      if (

        candidate.some(atom =>

          centered.some(coreAtom =>

            distance2(atom.p, coreAtom.p) <

              (atom.elem === "O" && coreAtom.elem !== "H"

                ? 2.75 : 1.9) ** 2

          )

        )

      ) continue;

      if (

        oxygens.some(p =>

          distance2(p, position) < 2.65 ** 2

        )

      ) continue;

      if (

        waters.some(molecule =>

          candidate.some(atom =>

            molecule.some(other => {

              const minimum =

                atom.elem === "O" && other.elem === "O" ? 2.65 :

                atom.elem === "H" && other.elem === "H" ? 1.45 :

                1.80;

              return distance2(atom.p, other.p) < minimum ** 2;

            })

          )

        )

      ) continue;

      waters.push(candidate);

      oxygens.push(position);

    }

    const allAtoms = centered.concat(waters.flat());

    waterBoxXYZ = wbText(

      allAtoms,

      `Molecule + ${waters.length} H2O; box ${lengths.join(" x ")} Angstrom; solute centered`

    );

    if (!waterBoxViewer) {

      waterBoxViewer = BeeMolMoleculeThree.createViewer("wbViewer", {

        backgroundColor: "#f8fbff",

        disableFog: true

      });

    }

    await waterBoxViewer.ready;
    waterBoxViewer.clear();

    const core = waterBoxViewer.addModel(

      wbText(centered, "Loaded molecule"), "xyz"

    );

    core.setStyle({}, {

      stick: {radius:0.16},

      sphere: {scale:0.33}

    });

    if (waters.length) {

      const shell = waterBoxViewer.addModel(

        wbText(waters.flat(), "Water"), "xyz"

      );

      shell.setStyle({}, {

        stick: {radius:0.075},

        sphere: {scale:0.15}

      });

    }

    wbEdges(lengths);

    waterBoxViewer.zoomTo();

    waterBoxViewer.resize();

    waterBoxViewer.render();
    syncAtomColorControls();

    wb("wbDownload").disabled = false;
    wb("wbDownloadPDB").disabled = false;
    wb("xyzInput").value = waterBoxXYZ;
    wb("atomCount").textContent = `${allAtoms.length} atoms`;
    status.textContent = `${waters.length} of ${count} waters placed; ${allAtoms.length} atoms.`;

  } catch (error) {

    waterBoxXYZ = null;
    wb("wbDownload").disabled = true;
    wb("wbDownloadPDB").disabled = true;
    status.textContent = error.message;

  } finally {
    wb("wbGenerate").disabled = false;
  }

}

wb("wbOpen").onclick = () => {

  switchViewerMode("molecule");

  wb("wbOpen").classList.add("active");

  wb("modeMoleculeBtn").classList.remove("active");

  document.querySelector("main.container")

    .classList.add("waterbox-active");

  wb("viewer").classList.add("hidden");

  wb("orbitalViewer").classList.add("hidden");

  wb("wbViewer").classList.remove("hidden");

  wb("waterBoxWorkspace").classList.remove("hidden");

  wb("moleculeControls").classList.add("hidden");

  wb("orientationControls").style.display = "none";
  requestAnimationFrame(syncAtomColorControls);

  wb("tabsCard").classList.add("hidden");

  wb("codeCard").classList.add("hidden");

  if (!waterBoxXYZ) {

    generateWaterBox();

  } else if (waterBoxViewer) {

    waterBoxViewer.resize();

    waterBoxViewer.render();

  }

};

wb("wbOpen").onkeydown = event => {

  if (event.key === "Enter" || event.key === " ") {

    event.preventDefault();

    wb("wbOpen").click();

  }

};

wb("wbGenerate").onclick = generateWaterBox;

for (const [inputId, textareaId] of [

  ["wbSoluteFile", "wbSolute"],

  ["wbWaterFile", "wbWater"]

]) {

  wb(inputId).onchange = async event => {

    const file = event.target.files[0];

    if (file) wb(textareaId).value = await file.text();

    event.target.value = "";

  };

}

function wbPDBFromXYZ(xyz) {

  const lines = xyz.trim().split(/\r?\n/);

  const match = (lines[1] || "").match(

    /box\s+([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s+Angstrom/i

  );

  if (!match) {

    throw Error("XYZ comment does not contain box lengths.");

  }

  const box = match.slice(1).map(Number);

  const atoms = wbParseXYZ(xyz, "Water box");

  if (atoms.length < 4 || (atoms.length - 4) % 3 !== 0) {

    throw Error("Expected HCCI followed by complete water molecules.");

  }

  const output = [

    "CRYST1"

      + box.map(v => v.toFixed(3).padStart(9)).join("")

      + [90, 90, 90].map(v => v.toFixed(2).padStart(7)).join("")

      + " P 1           1",

    "REMARK   1 HCCI WATER BOX GENERATED BY BeeMol"

  ];

  for (let i = 0; i < atoms.length; i++) {

    const atom = atoms[i];

    const atomName = i < 4

      ? ["H1", "C1", "C2", "I1"][i]

      : ["O", "H1", "H2"][(i - 4) % 3];

    const residue = i < 4 ? "HCI" : "HOH";

    const residueNumber = i < 4

      ? 1

      : Math.floor((i - 4) / 3) + 2;

    output.push(

      "HETATM"

      + String(i + 1).padStart(5)

      + " "

      + atomName.padEnd(4)

      + " "

      + residue

      + " A"

      + String(residueNumber).padStart(4)

      + "    "

      + atom.p.map(v => v.toFixed(3).padStart(8)).join("")

      + "  1.00  0.00          "

      + atom.elem.padStart(2)

    );

  }

  const conect = (atom, ...neighbors) =>

    "CONECT"

    + [atom, ...neighbors]

        .map(number => String(number).padStart(5))

        .join("");

  output.push(

    conect(1, 2),

    conect(2, 3, 3, 3),

    conect(3, 4)

  );

  for (let i = 5; i <= atoms.length; i += 3) {

    output.push(conect(i, i + 1, i + 2));

  }

  output.push("END");

  return output.join("\n") + "\n";

}

wb("wbDownloadPDB").onclick = () => {

  if (!waterBoxXYZ) return;

  try {

    const pdb = wbPDBFromXYZ(waterBoxXYZ);

    const url = URL.createObjectURL(

      new Blob([pdb], {type: "chemical/x-pdb"})

    );

    const link = document.createElement("a");

    link.href = url;

    link.download = "HCCI_water_box.pdb";

    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {

    wb("wbStatus").textContent = error.message;

  }

};

wb("wbDownload").onclick = () => {

  if (!waterBoxXYZ) return;

  const url = URL.createObjectURL(

    new Blob([waterBoxXYZ], {type:"chemical/x-xyz"})

  );

  const link = document.createElement("a");

  link.href = url;

  link.download = "HCCI_water_box.xyz";

  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

};

