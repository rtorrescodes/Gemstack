#!/usr/bin/env node
/**
 * Gemstack MCP (Model Context Protocol) Server
 * Exposes the Gemstack SDD state to any MCP-compliant AI client.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const manifest = require('../lib/manifest');

// MCP Protocol structures
function sendResponse(id, result, error = null) {
    const response = { jsonrpc: "2.0", id };
    if (error) response.error = error;
    else response.result = result;
    console.log(JSON.stringify(response));
}

function sendNotification(method, params) {
    console.log(JSON.stringify({ jsonrpc: "2.0", method, params }));
}

// Handlers
const tools = [
    {
        name: "get_current_tasks",
        description: "Devuelve la lista actual de tareas (tasks.md) del proyecto local.",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "get_security_rules",
        description: "Devuelve las reglas de seguridad militares (03-gemstack-security.md).",
        inputSchema: { type: "object", properties: {} }
    }
];

function handleInitialize(id) {
    sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
            tools: {}
        },
        serverInfo: {
            name: "gemstack-mcp",
            version: manifest.getVersion()
        }
    });
}

function handleCallTool(id, params) {
    const cwd = process.cwd();
    
    if (params.name === "get_current_tasks") {
        const tasksPath = path.join(cwd, 'specs', 'current', 'tasks.md');
        if (fs.existsSync(tasksPath)) {
            const content = fs.readFileSync(tasksPath, 'utf8');
            sendResponse(id, { content: [{ type: "text", text: content }] });
        } else {
            sendResponse(id, { content: [{ type: "text", text: "No hay tareas activas en specs/current/tasks.md" }] });
        }
    } 
    else if (params.name === "get_security_rules") {
        const rulesPath = path.join(cwd, '.agents', 'rules', '03-gemstack-security.md');
        if (fs.existsSync(rulesPath)) {
            const content = fs.readFileSync(rulesPath, 'utf8');
            sendResponse(id, { content: [{ type: "text", text: content }] });
        } else {
            sendResponse(id, { content: [{ type: "text", text: "Reglas de seguridad no encontradas." }] });
        }
    }
    else {
        sendResponse(id, null, { code: -32601, message: "Tool not found" });
    }
}

// Stdio Message Loop
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
        const msg = JSON.parse(line);
        if (msg.method === "initialize") {
            handleInitialize(msg.id);
        } else if (msg.method === "tools/list") {
            sendResponse(msg.id, { tools });
        } else if (msg.method === "tools/call") {
            handleCallTool(msg.id, msg.params);
        } else {
            // Ignore other methods for now to keep it lightweight
            if (msg.id) sendResponse(msg.id, null, { code: -32601, message: "Method not found" });
        }
    } catch (e) {
        // Silently drop bad JSON in this lightweight implementation
    }
});
