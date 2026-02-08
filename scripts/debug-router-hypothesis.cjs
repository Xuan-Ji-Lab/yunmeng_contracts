const hre = require("hardhat");

async function main() {
    const ROUTER = "0xAA0930e9AB7b0580b4e7F6A7082FFa101Ca62a14";
    const WISH_TOKEN = "0x00050c0d05b0f852c44aef369f188764fd417777";
    const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
    const AMOUNT_BNB = hre.ethers.parseEther("0.001");
    const [deployer] = await hre.ethers.getSigners();

    let coder;
    if (hre.ethers.AbiCoder) coder = new hre.ethers.AbiCoder();
    else coder = hre.ethers.utils.defaultAbiCoder;

    const selector = "0x2f71b237";

    // Helper to log error safely
    const logError = (e) => {
        if (e.data) {
            console.log(`   Reverted with data: ${e.data}`);
        } else {
            console.log(`   Reverted (Unknown)`);
        }
    };

    console.log("Hypothesis Testing on 0xce98791e...");

    // Original Test 1: MinOut = 0 -> Error 0xce98791e
    // Hypothesis: 0xce98791e means "MinOut cannot be zero" OR "Output < MinOut" (but here output should be > 0. unless liquidity is 0)

    // Test A: MinOut = 1 wei
    const typesA = ["uint256", "address[]", "address", "uint256"];
    const paramsA = [1n, [WBNB, WISH_TOKEN], deployer.address, Math.floor(Date.now() / 1000) + 3600];
    const dataA = selector + coder.encode(typesA, paramsA).slice(2);

    console.log("Test A: MinOut = 1 wei");
    try {
        await hre.ethers.provider.call({ to: ROUTER, data: dataA, value: AMOUNT_BNB });
        // If success or different error, then Param 1 IS MinOut.
        console.log("✅ SUCCESS!");
    } catch (e) { logError(e); }

    // Test B: MinOut = Huge (Should definitely fail with Slippage)
    const paramsB = [hre.ethers.parseEther("100000"), [WBNB, WISH_TOKEN], deployer.address, Math.floor(Date.now() / 1000) + 3600];
    const dataB = selector + coder.encode(typesA, paramsB).slice(2);

    console.log("Test B: MinOut = 100000 ETH");
    try {
        await hre.ethers.provider.call({ to: ROUTER, data: dataB, value: AMOUNT_BNB });
    } catch (e) { logError(e); }

    // Compare errors of A and B.
    // If Error A == Error B, then regardless of value, it fails. Maybe Liquidity is 0?
    // If Error A != Error B, then Param 1 IS controlling slippage.

}

main().catch(console.error);
