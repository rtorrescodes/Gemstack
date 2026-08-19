module.exports = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    ok: (msg) => console.log(`[OK] ${msg}`),
    error: (msg) => console.error(`[FAIL] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`)
};
