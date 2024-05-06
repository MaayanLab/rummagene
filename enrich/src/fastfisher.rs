pub struct FastFisher{f: Vec<f64>}

impl FastFisher {
  pub fn new() -> Self {
    FastFisher{f: vec![0.0]}
  }

  pub fn extend_to(self: &mut Self, max_size: usize) {
    while self.f.len() <= max_size {
      let i = self.f.len();
      self.f.push(self.f[i-1] + (i as f64).ln());
    }
  }

  pub fn with_capacity(max_size: usize) -> Self {
    let mut fisher = FastFisher::new();
    fisher.extend_to(max_size);
    fisher
  }

  fn get_p(self: &Self, a: usize, b: usize, c: usize, d: usize, same: f64) -> f64 {
    (same - (self.f[a] + self.f[b] + self.f[c] + self.f[d])).exp()
  }

  pub fn get_p_value(self: &Self, mut a: usize, mut b: usize, mut c: usize, mut d: usize) -> f64 {
    let n = a + b + c + d;
    if n > self.f.len() {
      return f64::NAN;
    }
    let same = self.f[a + b] + self.f[c + d] + self.f[a + c] + self.f[b + d] - self.f[n];
    let mut p = self.get_p(a, b, c, d, same);
    
    let minimum = usize::min(c, b);
    for _ in 0..minimum {
        a += 1;
        b -= 1;
        c -= 1;
        d += 1;
        p += self.get_p(a, b, c, d, same);
    }
    p
  }
}
