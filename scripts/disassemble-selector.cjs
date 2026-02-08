const hre = require("hardhat");

async function main() {
    // Portal Implementation 
    // We use lowercase to avoid checksum errors with hardhat-ethers strict strictness
    const IMPL_RAW = "0x019987eaDEaaCeB9cf98FC1fB45e68b2342e86B3";
    const IMPL = IMPL_RAW.toLowerCase();

    const SELECTOR = "ef7ec2e7";

    console.log(`Disassembling ${IMPL} for selector ${SELECTOR}...`);

    const code = await hre.ethers.provider.getCode(IMPL);
    if (code === "0x") return console.log("No code found at address.");

    // 1. Find Dispatcher Entry
    // 63 XXXXXXXX 14 61 XXXX 57
    const pattern = new RegExp(`63${SELECTOR}1461([0-9a-f]{4})57`, "i");
    const match = pattern.exec(code.slice(2));

    if (!match) {
        console.log("Selector not found in simple dispatch.");
        // Check for "dup1, push4, eq" pattern
        // 80 63 XXXXXXXX 14
        const pattern2 = new RegExp(`8063${SELECTOR}1461([0-9a-f]{4})57`, "i");
        const match2 = pattern2.exec(code.slice(2));
        if (match2) {
            console.log("Found in dup1 dispatch pattern!");
            const offsetHex = match2[1];
            const offset = parseInt(offsetHex, 16);
            console.log(`Jumps to offset: 0x${offsetHex} (${offset})`);
            analyzeFromOffset(code, offset);
        } else {
            console.log("Selector not found in bytecode.");
        }
        return;
    }

    const offsetHex = match[1];
    const offset = parseInt(offsetHex, 16);
    console.log(`Jumps to offset: 0x${offsetHex} (${offset})`);
    analyzeFromOffset(code, offset);
}

function analyzeFromOffset(code, offset) {
    const buffer = Buffer.from(code.slice(2), "hex");
    // Get ~500 bytes
    const funcBody = buffer.slice(offset, offset + 500);
    console.log(`Function Body (first 500 bytes): ${funcBody.toString("hex")}`);

    // Scan for CALLDATALOAD
    const offsets = new Set();

    for (let i = 0; i < funcBody.length - 2; i++) {
        if (funcBody[i] === 0x35) { // CALLDATALOAD
            const prev = funcBody[i - 1];
            if (prev >= 0x60 && prev <= 0x7f) { // PUSH1..PUSH32
                const pushLen = prev - 0x5f;
                if (i - 1 - pushLen >= 0) {
                    const val = funcBody.readUIntBE(i - 1 - pushLen, pushLen);
                    offsets.add(val);
                }
            }
        }
    }

    const sortedOffsets = Array.from(offsets).sort((a, b) => a - b);
    console.log("Found CALLDATALOAD Offsets:", sortedOffsets);

    // Inference
    // 4 -> param 1
    // 36 -> param 2 (0x24)
    // 68 -> param 3 (0x44)
    // 100 -> param 4 (0x64)
    // 132 -> param 5 (0x84)

    console.log(`Inferred Params Count: ${sortedOffsets.length}`);
    if (sortedOffsets.includes(4)) console.log("- Param 1 exists");
    if (sortedOffsets.includes(36)) console.log("- Param 2 exists");
    if (sortedOffsets.includes(68)) console.log("- Param 3 exists");
    if (sortedOffsets.includes(100)) console.log("- Param 4 exists");
    if (sortedOffsets.includes(132)) console.log("- Param 5 exists");
}

main().catch(console.error);
