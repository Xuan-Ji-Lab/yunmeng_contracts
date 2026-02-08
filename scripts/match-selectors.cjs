const hre = require("hardhat");

async function main() {
    const extracted = [
        "0x01ffc9a7", "0x072cfbd7", "0x0a7bb193", "0x0ba6324e", "0x0e6dfcd5", "0x153e66e6", "0x1d31e153", "0x1e83409a",
        "0x23d89f95", "0x248a9ca3", "0x24ea54f4", "0x26ef20d5", "0x2993734b", "0x2e2fdbd9", "0x2f2ff15d", "0x36568abe",
        "0x3b964cc0", "0x3ba6f26a", "0x3c6680e2", "0x4f7edf58", "0x54b0476c", "0x54fd4d50", "0x5c4bc504", "0x5d29f9f2",
        "0x5ed7ca5b", "0x6388eeb7", "0x641f5e35", "0x6a272462", "0x719f3089", "0x797669c9", "0x7b02b2c9", "0x7e15676e",
        "0x84e5eed0", "0x8c4313c1", "0x8d1e0ce6", "0x91d14854", "0x967a2a70", "0x9d55bde4", "0xa217fddf", "0xaffed0e0",
        "0xb5ac48a0", "0xb87224d0", "0xbcc4e791", "0xc4d66de8", "0xd547741f", "0xd7b3ec08", "0xd829b2ad", "0xdbde08f0",
        "0xdc3fcdc1", "0xe5f0f5cc", "0xeae8a630", "0xef7ec2e7", "0xf1464a2d", "0xf99abb9e", "0xfc847c2b", "0xfcb5c9e3"
    ];

    const candidates = [
        "buy(uint256)",
        "buy(uint256,uint256)",
        "buy(uint256,address)",
        "buy(uint256,address,uint256)",
        "buyETH(uint256,uint256)",
        "buyETH(uint256,address,uint256)",
        "swapETHForToken(address,uint256,address,uint256)",
        "swapExactETHForTokens(uint256,address[],address,uint256)",
        "swapExactInput(tuple(address inputToken,uint256 amountIn,address outputToken,uint256 minAmountOut,address recipient,uint256 deadline,bytes permitData))",
        "quoteExactInput(tuple(address inputToken,uint256 amountIn,address outputToken))",
        "create(string,string,uint256)",
        "launch(string,string,uint256,uint256,uint256,uint256,string)", // Guessing launch params
        "initialize(address)",
        "owner()",
        "transferOwnership(address)",
        "upgradeTo(address)",
        "implementation()",
        "quote(uint256)",
        "getAmountOut(uint256)"
    ];

    const extractedSet = new Set(extracted);

    console.log("Checking candidates against extracted selectors...");

    for (const sig of candidates) {
        const hash = hre.ethers.id(sig);
        const selector = hash.slice(0, 10);

        if (extractedSet.has(selector)) {
            console.log(`✅ MATCH: ${selector} -> ${sig}`);
        }
    }

    // Check standard ownership/upgrade
    // owner() -> 0x8da5cb5b
}

main().catch(console.error);
