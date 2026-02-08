const hre = require("hardhat");

async function main() {
    const TARGET = "0xef7ec2e7";
    console.log("Target:", TARGET);

    // Hypothesis: exactInput((address,address,uint256,uint256,bytes))
    const sigs = [
        "exactInput((address,address,uint256,uint256,bytes))",
        "swapExactInput((address,address,uint256,uint256,bytes))",
        "swap((address,address,uint256,uint256,bytes))",
        "buy((address,address,uint256,uint256,bytes))",
        // Maybe param 5 is address recipient?
        // But 0x00...0a0 is definitely an offset.
        // What if params are: (tokenIn, tokenOut, amountIn, minOut, recipient, data)
        // Offset 0xa0 would point to 6th slot.
        "exactInput((address,address,uint256,uint256,address,bytes))",

        // Maybe struct has names?
        "exactInput(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, bytes data))"
    ];

    for (const s of sigs) {
        const h = hre.ethers.id(s).slice(0, 10);
        console.log(`${s} -> ${h}`);
        if (h === TARGET) {
            console.log("✅ MATCH!");
        }
    }
}

main().catch(console.error);
