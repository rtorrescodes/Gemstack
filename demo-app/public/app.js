const userSelect = document.getElementById('user-select');
const docList = document.getElementById('doc-list');
const createForm = document.getElementById('create-form');
const testOutput = document.getElementById('test-output');

async function api(path, options = {}) {
    if (!options.headers) options.headers = {};
    const userId = userSelect.value;
    if (userId) options.headers['X-Mock-User-Id'] = userId;
    options.headers['Content-Type'] = 'application/json';
    
    const res = await fetch(`/api${path}`, options);
    const data = await res.json();
    return { status: res.status, data };
}

async function loadUsers() {
    const { data } = await api('/users');
    if (!data) return;
    userSelect.innerHTML = data.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    loadDocs();
}

async function loadDocs() {
    docList.innerHTML = 'Loading...';
    const { data } = await api('/docs');
    docList.innerHTML = '';
    if (!data) return;
    data.forEach(doc => {
        const li = document.createElement('li');
        li.textContent = `[ID: ${doc.id}] ${doc.title} - ${doc.content}`;
        docList.appendChild(li);
    });
}

userSelect.addEventListener('change', loadDocs);

createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const { status, data } = await api('/docs', {
        method: 'POST',
        body: JSON.stringify({ title, content })
    });
    if (status === 201) {
        document.getElementById('title').value = '';
        document.getElementById('content').value = '';
        loadDocs();
    } else {
        alert(data.error);
    }
});

// Test IDOR
document.getElementById('btn-read').addEventListener('click', async () => {
    const id = document.getElementById('test-id').value;
    const { status, data } = await api(`/docs/${id}`);
    testOutput.textContent = `Status: ${status}\n${JSON.stringify(data, null, 2)}`;
});

document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('test-id').value;
    const { status, data } = await api(`/docs/${id}`, { method: 'DELETE' });
    testOutput.textContent = `Status: ${status}\n${JSON.stringify(data, null, 2)}`;
    loadDocs();
});

loadUsers();
