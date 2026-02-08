const hre = require("hardhat");

async function main() {
    const FLAP_PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9"; // Portal
    const WISH_TOKEN = "0x00050c0d05b0f852c44aef369f188764fd417777";
    const AMOUNT_BNB = hre.ethers.parseEther("0.001");
    const deployer = (await hre.ethers.getSigners())[0];

    let coder;
    if (hre.ethers.AbiCoder) coder = new hre.ethers.AbiCoder();
    else coder = hre.ethers.utils.defaultAbiCoder;

    const selector = "0xef7ec2e7";

    console.log("Testing alternative structures...");

    // Hypothesis 4: 4 Params (Token, Amount, MinOut, Bytes) 
    // BUT maybe the Log's "a0" offset word was actually the start of the bytes?
    // If layout is: T(32), A(32), M(32), Off(32) -> 128 bytes total static.
    // If offset is 0x80 (128).
    // Let's try `tuple(address,uint256,uint256,bytes)`
    console.log("Test 4: (address, uint256, uint256, bytes)");
    try {
        const types = ["tuple(address,uint256,uint256,bytes)"];
        const params = [WISH_TOKEN, AMOUNT_BNB, 0, "0x"];
        const data = selector + coder.encode(types, [params]).slice(2);

        // Log generated data to compare with TX log manually if needed
        // console.log("Gen:", data);

        await hre.ethers.provider.call({ to: FLAP_PORTAL, data, value: AMOUNT_BNB });
        console.log("✅ SUCCESS (4 Params)!");
    } catch (e) {
        console.log("❌ Failed (4 Params):", e.message);
    }

    // Hypothesis 5: Amount is NOT in params? (Rely on msg.value)
    // (Token, MinOut, Bytes, Address)
    console.log("Test 5: (address, uint256, bytes, address) [No Amount]");
    try {
        const types = ["tuple(address,uint256,bytes,address)"];
        const params = [WISH_TOKEN, 0, "0x", deployer.address];
        const data = selector + coder.encode(types, [params]).slice(2);
        await hre.ethers.provider.call({ to: FLAP_PORTAL, data, value: AMOUNT_BNB });
        console.log("✅ SUCCESS (No Amount)!");
    } catch (e) {
        console.log("❌ Failed (No Amount)");
    }

    // Hypothesis 6: What if the struct is DIFFERENT?
    // Maybe (Token, Recipient, Amount, MinOut, Bytes)
    console.log("Test 6: (address, address, uint256, uint256, bytes)");
    try {
        const types = ["tuple(address,address,uint256,uint256,bytes)"];
        const params = [WISH_TOKEN, deployer.address, AMOUNT_BNB, 0, "0x"];
        const data = selector + coder.encode(types, [params]).slice(2);
        await hre.ethers.provider.call({ to: FLAP_PORTAL, data, value: AMOUNT_BNB });
        console.log("✅ SUCCESS (Token, Recipient...)!");
    } catch (e) {
        console.log("❌ Failed (Token, Recipient...)");
    }

    // Hypothesis 7: Replay exact raw data but swap WISH_TOKEN?
    // This is "cheating" but if it works it proves logic is OK, just ABI mismatch.
    // But I can't replicate raw data perfectly because I don't know the mystery bytes format if it's dynamic.

    // Let's try one more: (address, uint256, uint256, uint256, bytes)
    // Maybe "Comment" is stored as uint256 + bytes?
    // Or (Token, Amount, MinOut, ReferralCode, Bytes)
    console.log("Test 7: (address, uint256, uint256, bytes32, bytes)");
    try {
        const types = ["tuple(address,uint256,uint256,bytes32,bytes)"];
        const params = [WISH_TOKEN, AMOUNT_BNB, 0, hre.ethers.ZeroHash, "0x"];
        const data = selector + coder.encode(types, [params]).slice(2);
        await hre.ethers.provider.call({ to: FLAP_PORTAL, data, value: AMOUNT_BNB });
        console.log("✅ SUCCESS (Bytes32 + Bytes)!");
    } catch (e) {
        console.log("❌ Failed (Bytes32 + Bytes)");
    }
}

main().catch(console.error);
