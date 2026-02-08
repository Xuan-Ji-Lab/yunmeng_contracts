const hre = require("hardhat");

async function main() {
    const selector = "0xce98791e";
    console.log("Decoding Error Selector:", selector);

    // Common errors
    const errors = [
        "TooLittleReceived()",
        "TransferFailed()",
        "Expired()",
        "IdenticalAddresses()",
        "ZeroAddress()",
        "InsufficientLiquidity()",
        "InsufficientInputAmount()",
        "InsufficientOutputAmount()",
        "InvalidPath()",
        "SlippageCheck()",
        "MinReturnError(uint256,uint256)",
        "PriceSlippage()",
        "OutputInsufficient()",
        "ReturnAmountIsNotEnough()",
        "K()"
    ];

    for (const err of errors) {
        const hash = hre.ethers.id(err).slice(0, 10);
        console.log(`${err} -> ${hash}`);
        if (hash === selector) {
            console.log("\n✅ MATCH FOUND:", err);
            return;
        }
    }

    console.log("\nNo common match found. Try brute force or online DB.");
}

main().catch(console.error);
