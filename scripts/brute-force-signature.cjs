const hre = require("hardhat");

async function main() {
    const TARGET = "0xef7ec2e7";
    console.log("Brute forcing signature for:", TARGET);

    const names = [
        "buy", "buyToken", "buyTokens", "buyETH", "buyWithETH", "buyExactIn", "buyExactOut",
        "swap", "swapToken", "swapTokens", "swapETH", "swapWithETH", "swapExactInput", "swapExactOutput",
        "trade", "execute", "launch", "mint", "deposit", "quote",
        "swapETHForToken", "swapExactETHForTokens",
        "exactInput", "exactOutput",
        "multicall", "claim", "invest"
    ];

    const structs = [
        "(address,uint256,uint256,bytes,address)",
        "(address,uint256,uint256,bytes,uint256)",
        "(address,uint256,uint256,bytes,bytes32)",
        "(address,uint256,uint256,bytes,bool)",
        "(address,uint256,uint256,address,address)", // Maybe bytes is misleading
        "((address,uint256,uint256,bytes,address))", // Tuple
        "(address,uint256,uint256,bytes,address,uint256)",
        // Try known standards
        "(address,uint256,uint256,address,uint256)",
        "(address,uint256,address,bytes)"
    ];

    // Also try without tuple if they are top level (unlikely given offset 0x20)

    for (const name of names) {
        for (const args of structs) {
            const sig = `${name}${args}`;
            const hash = hre.ethers.id(sig).slice(0, 10);
            if (hash === TARGET) {
                console.log(`✅ MATCH FOUND: ${sig}`);
                return;
            }
        }
    }

    console.log("No simple match found.");

    // Try adding "tuple" explicit
    for (const name of names) {
        const sig = `${name}(tuple(address,uint256,uint256,bytes,address))`;
        const hash = hre.ethers.id(sig).slice(0, 10);
        if (hash === TARGET) console.log(`✅ MATCH FOUND: ${sig}`);

        const sig2 = `${name}(tuple(address,uint256,uint256,bytes,uint256))`;
        const hash2 = hre.ethers.id(sig2).slice(0, 10);
        if (hash2 === TARGET) console.log(`✅ MATCH FOUND: ${sig2}`);
    }
}

main().catch(console.error);
