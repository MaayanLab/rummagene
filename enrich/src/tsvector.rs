use std::collections::HashSet;

#[derive(Clone, PartialEq, Eq, Hash)]
pub struct Trigram(char, char, char);
pub struct TSVector(HashSet<Trigram>);

impl Default for TSVector {
  fn default() -> Self {
    TSVector(HashSet::new())
  }
}

impl From<&str> for TSVector {
  fn from(value: &str) -> Self {
    let mut ts = TSVector::default();
    ts.update(value);
    ts
  }
}

impl TSVector {
  pub fn update(&mut self, text: &str) {
    let mut trgm = Trigram(' ', ' ', ' ');
    for ch in text.chars() {
      trgm.0 = trgm.1;
      trgm.1 = trgm.2;
      trgm.2 = ch;
      self.0.insert(trgm.clone());
    }
    trgm.0 = trgm.1;
    trgm.1 = trgm.2;
    trgm.2 = ' ';
    self.0.insert(trgm.clone());
    trgm.0 = trgm.1;
    trgm.1 = trgm.2;
    trgm.2 = ' ';
    self.0.insert(trgm.clone());
  }

  pub fn cmp(&self, other: &TSVector) -> f64 {
    (self.0.intersection(&other.0).count() as f64)/(self.0.union(&other.0).count() as f64)
  }
}
