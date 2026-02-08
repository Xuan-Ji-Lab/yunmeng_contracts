const hre = require("hardhat");

/**
 * 提取合约字节码中的函数选择器
 * 简单的反汇编逻辑: 查找 PUSH4 (0x63) 指令
 */
async function main() {
    // Portal Implementation Address
    const IMPL = "0x019987eadeaaceb9cf98fc1fb45e68b2342e86b3";
    console.log("Extracting Selectors from:", IMPL);

    const code = await hre.ethers.provider.getCode(IMPL);
    if (code === "0x") {
        console.error("No code found!");
        return;
    }

    // console.log("Code length:", code.length);

    // 简单的 PUSH4 提取器
    // EVM Opcode: PUSH4 = 0x63
    // Pattern: 63 XXXXXXXX 14 (EQ) or similar in dispatcher

    // Convert hex string to byte array for easier scanning? 
    // Just regex search string.

    // Look for "63" followed by 8 hex chars
    const regex = /63([0-9a-f]{8})14/g;
    let match;
    const selectors = new Set();

    // Note: This is heuristic and might miss optimized dispatchers, but usually works for standard solidity.
    while ((match = regex.exec(code.slice(2))) !== null) {
        selectors.add("0x" + match[1]);
    }

    console.log(`Found ${selectors.size} selectors:`);
    const sorted = Array.from(selectors).sort();

    // 尝试匹配常见签名
    // 这里我们只是打印出来，后续可以去 database 查，或者自己 hash 常见函数比对
    for (const sel of sorted) {
        console.log(sel);
    }

    // 同时也检查一下是否包含 0x2e2fdbd9 (用户调用的 Launch)
    if (selectors.has("0x2e2fdbd9")) {
        console.log("\n✅ Confirmed: Contract contains '0x2e2fdbd9' (Launch)");
    } else {
        console.log("\n⚠️ Warning: '0x2e2fdbd9' not found in PUSH4 instructions (might be in fallback or different dispatch type)");
    }
}

main().catch(console.error);
