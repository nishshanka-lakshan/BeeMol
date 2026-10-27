"""Compare the actual browser evaluator with PySCF (requires pyscf and quickjs).

Run: python3 orbital-visualization/test_orbital_grid.py [reference.molden]
The generated fixture tests every s/p/d/f component and contracted primitives.
An optional Molden file additionally tests all its molecular orbitals.
"""

import json
from pathlib import Path
import sys
import tempfile

import numpy as np
import quickjs
from pyscf import gto
from pyscf.tools import molden


def compare(path):
    mol, _, coefficients, *_ = molden.load(str(path))
    rng = np.random.default_rng(123)
    atoms = mol.atom_coords()
    points = np.vstack((
        atoms,
        atoms + rng.normal(size=atoms.shape),
        rng.uniform(atoms.min(axis=0) - 3, atoms.max(axis=0) + 3, (100, 3)),
    ))
    runtime = quickjs.Context()
    runtime.eval(Path(__file__).with_name('orbital-grid.js').read_text())
    runtime.eval('const model=parseMoldenForGrid(' + json.dumps(path.read_text()) + ');')
    runtime.eval('const points=' + json.dumps(points.tolist()) + ';')
    actual = np.array(json.loads(runtime.eval(
        'JSON.stringify(points.map(p=>model.orbitals.map(m=>moldenOrbitalAt(model,m,...p))))'
    )))
    expected = mol.eval_gto('GTOval_sph', points) @ coefficients
    np.testing.assert_allclose(actual, expected, atol=1e-10, rtol=1e-9)
    print(f'{path.name}: {actual.shape[1]} orbitals, {len(points)} points, '
          f'max absolute error {np.max(np.abs(actual - expected)):.3g}')


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as directory:
        fixture = Path(directory) / 'normalized_spdf.molden'
        molecule = gto.M(
            atom='He 0 0 0', unit='Bohr', cart=False,
            basis={'He': [[l, [1.7, 0.3], [0.2, -0.15], [0.06, 0.8]]
                          for l in range(4)]},
            verbose=0,
        )
        molden.from_mo(molecule, str(fixture), np.eye(molecule.nao_nr()))
        compare(fixture)
    for filename in sys.argv[1:]:
        compare(Path(filename))
