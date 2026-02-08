const hre = require("hardhat");

async function main() {
    const TARGET = "0x2f71b237";
    console.log("Cracking Router Selector:", TARGET);

    const verbs = ["swap", "buy", "sell", "exact", "execute"];
    const middles = ["ExactETH", "ETH", "Tokens", "Asset", "Input", "Output"];
    const ends = ["ForTokens", "ForETH", "ForExactTokens", "ForExactETH", "SupportingFeeOnTransferTokens", ""];

    const signatures = [];

    // Generate names
    for (const v of verbs) {
        for (const m of middles) {
            for (const e of ends) {
                signatures.push(`${v}${m}${e}`);
                // camelCase
                signatures.push(`${v}${m}${e}`);
            }
        }
    }

    // Add known variations
    signatures.push("swapExactETHForTokensSupportingFeeOnTransferTokens");
    signatures.push("swapExactETHForTokens");

    // Param types for 4 args
    // 0x2f71b237 has 4 CALLDATALOADs
    const argsList = [
        "(uint256,address[],address,uint256)", // V2 Standard
        "(uint256,uint256,address[],address)",
        "(address,uint256,uint256,uint256)", // Token, Amount, MinOut, Deadline
        "(address,uint256,uint256,address)", // Token, Amount, MinOut, To
        "(uint256,address,uint256,uint256)",
        "(uint256,address,address,uint256)",
        "(address[],uint256,address,uint256)",
        "(address[],uint256,uint256,address)",
        "(address,address,uint256,uint256)"
    ];

    for (const name of signatures) {
        // CamelCase conversion: first letter lower
        const camel = name.charAt(0).toLowerCase() + name.slice(1);

        for (const args of argsList) {
            const sig = `${camel}${args}`;
            const hash = hre.ethers.id(sig).slice(0, 10);
            if (hash === TARGET) {
                console.log(`✅ FOUND MATCH: ${sig}`);
                return;
            }
        }
    }

    console.log("No match found in common combinations.");

    // Check specific specific guesses
    const guesses = [
        "swapExactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160))",
        "exactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160))"
    ];
    for (const sig of guesses) {
        if (hre.ethers.id(sig).slice(0, 10) === TARGET) {
            console.log(`✅ FOUND MATCH: ${sig}`);
        }
    }
}

main().catch(console.error);
