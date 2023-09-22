/**
 * This allows you to read/write from the hashmap and the values such that
 * it's possible to read independent values even while the hashmap is
 * being written to.
 */
use async_lock::{RwLock,RwLockReadGuardArc, RwLockWriteGuardArc};
use std::borrow::Borrow;
use std::hash::Hash;
use std::sync::Arc;
use std::collections::HashMap;

pub struct RwLockHashMap<K, V>(RwLock<HashMap<K, Arc<RwLock<V>>>>);

impl<K, V> RwLockHashMap<K, V>
where K: Eq + PartialEq + Hash {
  pub fn new() -> Self {
    RwLockHashMap(RwLock::new(HashMap::new()))
  }

  pub async fn contains_key<Q: ?Sized>(&self, k: &Q) -> bool
  where K: Borrow<Q>, Q: Hash + Eq {
    let reader = self.0.read().await;
    (*reader).contains_key(k)
  }

  pub async fn remove<Q: ?Sized>(&self, k: &Q) -> bool
  where K: Borrow<Q>, Q: Hash + Eq {
    let mut writer = self.0.write().await;
    (*writer).remove(k).is_some()
  }

  pub async fn get_read<Q: ?Sized>(&self, k: &Q) -> Option<RwLockReadGuardArc<V>>
  where K: Borrow<Q>, Q: Hash + Eq {
    let reader = self.0.read().await;
    let value = reader.get(&k)?.read_arc().await;
    Some(value)
  }

  pub async fn insert_write(&self, k: K, v: V) -> RwLockWriteGuardArc<V> {
    let mut writer = self.0.write().await;
    let v = Arc::new(RwLock::new(v));
    writer.insert(k, v.clone());
    v.write_arc().await
  }
}
