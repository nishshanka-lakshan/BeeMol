"""Exercise real RDKit embedding, force fields, and HTTP integration."""
import json
import math
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
from geometry import optimize_geometry
from server import Handler

try:
    from rdkit import Chem
except ImportError:
    Chem = None

@unittest.skipIf(Chem is None, 'Install requirements.txt to test geometry with RDKit')
class GeometryTests(unittest.TestCase):
    def test_ethanol_adds_hydrogens_and_relaxes(self):
        r = optimize_geometry({'structure': 'CCO'})
        self.assertEqual(r['forceField'], 'MMFF94')
        self.assertTrue(r['converged'])
        self.assertLessEqual(r['energy'], r['initialEnergy'] + 1e-6)
        self.assertEqual(int(r['xyz'].splitlines()[0]), 9)
        self.assertEqual((r['charge'], r['spin']), (0, 0))
        self.assertTrue(all(math.isfinite(float(x)) for row in r['xyz'].splitlines()[2:] for x in row.split()[1:]))

    def test_sketch_molblock_and_formal_charge(self):
        # This is the same V2000 layout emitted by the browser sketcher.
        block = '\n'.join(['BeeMol sketch', '  BeeMol', '',
            '  1  0  0  0  0  0            999 V2000',
            '    0.0000    0.0000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0',
            'M  CHG  1   1   1', 'M  END'])
        r = optimize_geometry({'format': 'molfile', 'structure': block})
        self.assertEqual(r['charge'], 1)
        self.assertEqual(int(r['xyz'].splitlines()[0]), 5)

    def test_uff_explicit_and_fallback(self):
        self.assertEqual(optimize_geometry({'structure': 'CCO', 'forceField': 'UFF'})['forceField'], 'UFF')
        self.assertEqual(optimize_geometry({'structure': '[BH3]'})['forceField'], 'UFF')

    def test_stereochemistry_survives(self):
        r = optimize_geometry({'structure': 'N[C@@H](C)C(=O)O'})
        self.assertIn('@', r['smiles'])

    def test_invalid_structures(self):
        for request in ({'structure': 'garbage'}, {'structure': 'C.C'},
                        {'structure': 'C', 'spin': 1}, {'structure': '[CH3]', 'spin': 0},
                        {'structure': 'C', 'spin': True}, {'structure': 'C', 'forceField': 'fake'},
                        {'structure': 'C'*101}, {'structure': 'C', 'format': 'xyz'}, []):
            with self.subTest(request=request), self.assertRaises(ValueError):
                optimize_geometry(request)

    def test_open_shell_spin(self):
        self.assertEqual(optimize_geometry({'structure': '[CH3]', 'spin': 1})['spin'], 1)

    def test_spatial_geometry_is_not_reembedded(self):
        from unittest.mock import patch
        from rdkit.Chem import AllChem
        molecule = Chem.AddHs(Chem.MolFromSmiles('O'))
        AllChem.EmbedMolecule(molecule, randomSeed=42)
        molecule.GetConformer().Set3D(True)
        block = Chem.MolToMolBlock(molecule)
        with patch.object(AllChem, 'EmbedMolecule', side_effect=AssertionError('Must retain spatial coordinates')):
            r = optimize_geometry({'format': 'molfile', 'structure': block, 'preserveGeometry': True})
        self.assertTrue(r['converged'])
        self.assertEqual(len(r['atoms']), 3)
        self.assertEqual(len(r['bonds']), 2)

    def test_optimized_aromatic_bonds_remain_editable(self):
        r = optimize_geometry({'structure': 'c1ccccc1'})
        self.assertEqual(sum(b['order'] == 2 for b in r['bonds']), 3)
        self.assertEqual(len(r['atoms']), 12)

    def test_uff_animation_frames(self):
        r = optimize_geometry({'structure': 'CCO', 'forceField': 'UFF', 'includeFrames': True})
        self.assertEqual(r['forceField'], 'UFF')
        self.assertGreater(len(r['frames']), 1)
        self.assertLessEqual(len(r['frames']), 101)
        self.assertEqual(len(r['frames'][0]), len(r['atoms']))
        self.assertNotEqual(r['frames'][0], r['frames'][-1])
        for point, atom in zip(r['frames'][-1], r['atoms']):
            for value, axis in zip(point, ('x', 'y', 'z')):
                self.assertAlmostEqual(value, atom[axis])
        self.assertLessEqual(r['energy'], r['initialEnergy'])

    def test_http_geometry_and_origin(self):
        httpd = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=httpd.serve_forever, daemon=True)
        worker.start()
        endpoint = f'http://127.0.0.1:{httpd.server_port}/api/geometry'
        try:
            req = Request(endpoint, data=json.dumps({'structure': 'O'}).encode(),
                          headers={'Content-Type': 'application/json', 'Origin': 'http://localhost:8000'})
            with urlopen(req) as response:
                self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://localhost:8000')
                self.assertEqual(int(json.load(response)['xyz'].splitlines()[0]), 3)
            for origin, body, expected in [('http://evil.invalid', {'structure': 'O'}, 403),
                                           ('http://localhost:8000', {'structure': 'bad'}, 400)]:
                req = Request(endpoint, data=json.dumps(body).encode(), headers={'Origin': origin})
                with self.assertRaises(HTTPError) as error:
                    urlopen(req)
                self.assertEqual(error.exception.code, expected)
        finally:
            httpd.shutdown(); httpd.server_close(); worker.join()

if __name__ == '__main__':
    unittest.main()
