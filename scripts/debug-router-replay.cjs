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

    console.log(`Replaying Router ${selector}...`);

    // Helper to log error safely
    const logError = (e) => {
        if (e.data) {
            console.log(`   Reverted with data: ${e.data}`);
        } else if (e.message) {
            console.log(`   Reverted with message: ${e.message}`);
        } else {
            console.log(`   Reverted (Unknown)`);
        }
    };

    // Test 1: V2 Standard (AmountOutMin, Path[], To, Deadline)
    const types1 = ["uint256", "address[]", "address", "uint256"];
    const params1 = [0, [WBNB, WISH_TOKEN], deployer.address, Math.floor(Date.now() / 1000) + 3600];
    const data1 = selector + coder.encode(types1, params1).slice(2);

    console.log("Test 1: (minOut, path[], to, deadline)");
    try {
        await hre.ethers.provider.call({ to: ROUTER, data: data1, value: AMOUNT_BNB });
        console.log("✅ SUCCESS!");
    } catch (e) { logError(e); }

    // Test 2: Direct (Token, MinOut, To, Deadline)
    // Maybe path is implied?
    const types2 = ["address", "uint256", "address", "uint256"];
    const params2 = [WISH_TOKEN, 0, deployer.address, Math.floor(Date.now() / 1000) + 3600];
    const data2 = selector + coder.encode(types2, params2).slice(2);

    console.log("Test 2: (token, minOut, to, deadline)");
    try {
        await hre.ethers.provider.call({ to: ROUTER, data: data2, value: AMOUNT_BNB });
        console.log("✅ SUCCESS!");
    } catch (e) { logError(e); }

    // Test 3: (AmountOutMin, Path[], To) -- No Deadline
    const types3 = ["uint256", "address[]", "address"];
    const params3 = [0, [WBNB, WISH_TOKEN], deployer.address];
    const data3 = selector + coder.encode(types3, params3).slice(2);

    console.log("Test 3: (minOut, path[], to) [No Deadline]");
    try {
        await hre.ethers.provider.call({ to: ROUTER, data: data3, value: AMOUNT_BNB });
        console.log("✅ SUCCESS!");
    } catch (e) { logError(e); }

    // Test 4: 5 Params (Integrate Referral?)
    // (MinOut, Path[], To, Deadline, Referrer)
    const types4 = ["uint256", "address[]", "address", "uint256", "address"];
    const params4 = [0, [WBNB, WISH_TOKEN], deployer.address, Math.floor(Date.now() / 1000) + 3600, hre.ethers.ZeroAddress];
    const data4 = selector + coder.encode(types4, params4).slice(2);
    console.log("Test 4: (minOut, path[], to, deadline, referrer)");
    try {
        await hre.ethers.provider.call({ to: ROUTER, data: data4, value: AMOUNT_BNB });
        console.log("✅ SUCCESS!");
    } catch (e) { logError(e); }
}

main().catch(console.error);
