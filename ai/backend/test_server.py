import math, unittest
from server import analyze
class AnalysisTests(unittest.TestCase):
    def dataset(self,points): return {'datasets':[{'timeUnit':'atomic_unit','label':'test','points':points}]}
    def test_plateau(self):
        s=analyze(self.dataset([[0,0],[1,1],[2,1],[3,0]]))['datasets'][0]
        self.assertEqual(s['sampled_local_maxima_count'],1)
        self.assertAlmostEqual(s['strongest_sampled_local_maxima'][0]['time_fs'],1.5*0.024188843265857)
    def test_duplicate_time(self):
        with self.assertRaises(ValueError): analyze(self.dataset([[0,1],[0,.8]]))
    def test_nonfinite(self):
        with self.assertRaises(ValueError): analyze(self.dataset([[0,1],[1,math.nan]]))
    def test_units(self):
        with self.assertRaises(ValueError): analyze({'datasets':[{'points':[[0,1],[1,0]]}]})
    def test_endpoints_not_peaks(self):
        s=analyze(self.dataset([[0,1],[1,.5],[2,.1]]))['datasets'][0]
        self.assertEqual(s['sampled_local_maxima_count'],0)
if __name__=='__main__': unittest.main()
