const API_BASE = '/api';

export async function listSaves() {
  const res = await fetch(`${API_BASE}/saves`);
  if (!res.ok) throw new Error('无法读取存档列表');
  return res.json();
}

export async function loadSave(id) {
  const res = await fetch(`${API_BASE}/saves/${id}`);
  if (!res.ok) throw new Error('存档不存在');
  return res.json();
}

export async function createSave(name, state) {
  const res = await fetch(`${API_BASE}/saves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, state }),
  });
  if (!res.ok) throw new Error('存档失败');
  return res.json();
}

export async function deleteSave(id) {
  const res = await fetch(`${API_BASE}/saves/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('删除失败');
  return res.json();
}
