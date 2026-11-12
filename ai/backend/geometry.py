"""Generate force-field starting geometries; no AI or PySCF execution required."""
import math


def optimize_geometry(data):
    if not isinstance(data, dict):
        raise ValueError('Expected a molecule request.')
    try:
        from rdkit import Chem
        from rdkit.Chem import AllChem
    except ImportError as exc:
        raise RuntimeError('Geometry tools need RDKit. Install ai/backend/requirements.txt and restart the backend.') from exc
    source = data.get('structure', '')
    fmt = data.get('format', 'smiles')
    if not isinstance(source, str) or not source.strip() or len(source) > 100000:
        raise ValueError('Provide a drawn structure or SMILES (under 100000 characters).')
    if fmt not in ('smiles', 'molfile'):
        raise ValueError('Structure format must be smiles or molfile.')
    mol = Chem.MolFromSmiles(source) if fmt == 'smiles' else Chem.MolFromMolBlock(source, removeHs=False)
    if mol is None or not mol.GetNumAtoms():
        raise ValueError('Cannot read this structure. Check bonds, atom valences, and formal charges.')
    if mol.GetNumAtoms() > 100:
        raise ValueError('Please use at most 100 drawn atoms.')
    if len(Chem.GetMolFrags(mol)) != 1:
        raise ValueError('Draw one connected molecule. Separate fragments need a manually prepared relative geometry.')
    charge = Chem.GetFormalCharge(mol)
    spin = data.get('spin', 0)
    if isinstance(spin, bool) or not isinstance(spin, int) or spin < 0:
        raise ValueError('PySCF spin must be a nonnegative integer (2S).')
    preserve = data.get('preserveGeometry') is True and fmt == 'molfile' and mol.GetNumConformers() > 0
    mol = Chem.AddHs(mol, addCoords=preserve)
    if mol.GetNumAtoms() > 300:
        raise ValueError('Structure exceeds 300 atoms including hydrogens.')
    electrons = sum(a.GetAtomicNum() for a in mol.GetAtoms()) - charge
    radicals = sum(a.GetNumRadicalElectrons() for a in mol.GetAtoms())
    if spin > electrons or (electrons - spin) % 2:
        raise ValueError('Spin is incompatible with the electron count. Use odd spin for odd electrons and even spin for even electrons.')
    field = data.get('forceField', 'auto')
    if field not in ('auto', 'MMFF94', 'UFF'):
        raise ValueError('Unknown force field.')
    if field == 'auto':
        field = 'MMFF94' if AllChem.MMFFHasAllMoleculeParams(mol) else 'UFF'
    supported = AllChem.MMFFHasAllMoleculeParams(mol) if field == 'MMFF94' else AllChem.UFFHasAllMoleculeParams(mol)
    if not supported:
        raise ValueError(f'{field} has no parameters for this structure. Prepare its geometry manually.')
    if not preserve:
        # Embed flat sketches; retain explicitly constructed spatial geometries.
        mol.RemoveAllConformers()
        params = AllChem.ETKDGv3()
        params.randomSeed = 61453
        params.numThreads = 1
        params.maxIterations = 1000
        if AllChem.EmbedMolecule(mol, params) < 0:
            params.useRandomCoords = True
            if AllChem.EmbedMolecule(mol, params) < 0:
                raise ValueError('3D embedding failed. Check the structure or simplify constrained rings.')
    if field == 'MMFF94':
        props = AllChem.MMFFGetMoleculeProperties(mol, mmffVariant='MMFF94')
        ff = AllChem.MMFFGetMoleculeForceField(mol, props)
    else:
        ff = AllChem.UFFGetMoleculeForceField(mol)
    if ff is None:
        raise ValueError('Could not construct the force field.')
    initial_energy = ff.CalcEnergy()
    frames = []
    if data.get('includeFrames') is True:
        frames.append(mol.GetConformer().GetPositions().tolist())
        for _ in range(100):
            status = ff.Minimize(maxIts=20)
            frames.append(mol.GetConformer().GetPositions().tolist())
            if status == 0:
                break
    else:
        status = ff.Minimize(maxIts=2000)
    energy = ff.CalcEnergy()
    coords = mol.GetConformer().GetPositions()
    if not all(math.isfinite(float(v)) for row in coords for v in row) or not math.isfinite(energy):
        raise ValueError('Optimization produced invalid geometry.')
    xyz = [str(mol.GetNumAtoms()), f'BeeMol {field}; energy={energy:.6f} kcal/mol; charge={charge}; spin={spin}; angstrom']
    xyz += [f'{a.GetSymbol():2s} {p[0]: .8f} {p[1]: .8f} {p[2]: .8f}' for a, p in zip(mol.GetAtoms(), coords)]
    warnings = ['Force-field geometry is a starting point, not a quantum-optimized or global-minimum structure.']
    if radicals or spin:
        warnings.append('Force fields do not model electronic spin states; refine open-shell structures with a suitable quantum method.')
    if field == 'UFF':
        warnings.append('UFF was used; inspect unusual bonding and metal coordination carefully.')
    if status:
        warnings.append('Optimization reached its iteration limit; inspect or refine the geometry before use.')
    display_mol = Chem.Mol(mol)
    Chem.Kekulize(display_mol, clearAromaticFlags=True)
    return {'xyz': '\n'.join(xyz) + '\n', 'charge': charge, 'spin': spin,
            'forceField': field, 'converged': status == 0, 'energy': energy,
            'frames': frames, 'initialEnergy': initial_energy, 'energyUnit': 'kcal/mol',
            'smiles': Chem.MolToSmiles(Chem.RemoveHs(mol)), 'warnings': warnings,
            'atoms': [{'elem': a.GetSymbol(), 'charge': a.GetFormalCharge(),
                       'x': float(p[0]), 'y': float(p[1]), 'z': float(p[2])}
                      for a, p in zip(mol.GetAtoms(), coords)],
            'bonds': [{'a': b.GetBeginAtomIdx(), 'b': b.GetEndAtomIdx(),
                       'order': int(b.GetBondTypeAsDouble())} for b in display_mol.GetBonds()]}
