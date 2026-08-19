const { spawn } = require('child_process');
const http = require('http');

const PORT = 3000;
const API_URL = `http://localhost:${PORT}/api`;

async function fetchApi(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_URL + path);
        const req = http.request(url, {
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(JSON.stringify(options.body));
        req.end();
    });
}

function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function checkHealth() {
    for (let i = 0; i < 10; i++) {
        try {
            const res = await fetchApi('/health');
            if (res.status === 200 && res.data.ok) return true;
        } catch (e) {
            // ignore
        }
        await wait(500);
    }
    return false;
}

async function runTests() {
    let failed = false;
    function assert(condition, message) {
        if (condition) {
            console.log(`[OK] ${message}`);
        } else {
            console.error(`[FAIL] ${message}`);
            failed = true;
        }
    }

    try {
        console.log('[INFO] Starting Smoke Tests...');
        
        // 1. Get users
        const users = await fetchApi('/users');
        assert(users.status === 200 && users.data.length >= 2, 'Users fetched correctly');
        
        const aliceId = users.data.find(u => u.name === 'Alice').id;
        const bobId = users.data.find(u => u.name === 'Bob').id;
        
        // 2. Alice creates a doc
        const createA = await fetchApi('/docs', {
            method: 'POST',
            headers: { 'X-Mock-User-Id': aliceId, 'Content-Type': 'application/json' },
            body: { title: 'Alice Smoke Doc', content: 'Secret A' }
        });
        assert(createA.status === 201, 'Alice created document');
        const docA_Id = createA.data.id;

        // 3. Bob tries to GET Alice's doc (IDOR Test)
        const getB = await fetchApi(`/docs/${docA_Id}`, {
            headers: { 'X-Mock-User-Id': bobId }
        });
        assert(getB.status === 404, `Bob blocked from reading Alice's doc (Status ${getB.status})`);

        // 4. Bob tries to DELETE Alice's doc (IDOR Test)
        const delB = await fetchApi(`/docs/${docA_Id}`, {
            method: 'DELETE',
            headers: { 'X-Mock-User-Id': bobId }
        });
        assert(delB.status === 404, `Bob blocked from deleting Alice's doc (Status ${delB.status})`);

        // 5. Test malicious user_id injection in body
        const createMalicious = await fetchApi('/docs', {
            method: 'POST',
            headers: { 'X-Mock-User-Id': bobId, 'Content-Type': 'application/json' },
            body: { user_id: aliceId, title: 'Bob Fake Doc', content: 'Fake' }
        });
        assert(createMalicious.status === 201, 'Bob created doc with malicious payload');
        const fakeDocId = createMalicious.data.id;
        
        // Verify the doc actually belongs to Bob, not Alice
        const verifyAlice = await fetchApi(`/docs/${fakeDocId}`, { headers: { 'X-Mock-User-Id': aliceId } });
        assert(verifyAlice.status === 404, 'Malicious payload ignored: Doc does not belong to Alice');
        
        const verifyBob = await fetchApi(`/docs/${fakeDocId}`, { headers: { 'X-Mock-User-Id': bobId } });
        assert(verifyBob.status === 200, 'Malicious payload ignored: Doc belongs to Bob safely');

    } catch (e) {
        console.error(`[FAIL] Unhandled error: ${e.message}`);
        failed = true;
    }

    return failed;
}

async function main() {
    console.log('[INFO] Spawning server...');
    const server = spawn('node', ['server.js'], { stdio: 'ignore' });
    
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        console.error('[FAIL] Server did not start properly or healthcheck failed');
        server.kill();
        process.exit(1);
    }
    console.log('[OK] Server is healthy');

    const failed = await runTests();

    server.kill();
    console.log(`[INFO] Server stopped. Smoke tests completed.`);
    process.exit(failed ? 1 : 0);
}

main();
