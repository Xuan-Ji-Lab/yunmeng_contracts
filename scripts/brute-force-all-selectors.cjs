const hre = require("hardhat");

async function main() {
    const FLAP_PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9";
    const WISH_TOKEN = "0x00050c0d05b0f852c44aef369f188764fd417777";
    const [deployer] = await hre.ethers.getSigners();
    const AMOUNT_BNB = hre.ethers.parseEther("0.001");

    // Ethers version compatibility
    let coder;
    if (hre.ethers.AbiCoder) {
        coder = new hre.ethers.AbiCoder(); // v6
    } else {
        coder = hre.ethers.utils.defaultAbiCoder; // v5
    }

    const selectors = [
        "0x01ffc9a7", "0x072cfbd7", "0x0a7bb193", "0x0ba6324e", "0x0e6dfcd5", "0x153e66e6", "0x1d31e153", "0x1e83409a",
        "0x23d89f95", "0x248a9ca3", "0x24ea54f4", "0x26ef20d5", "0x2993734b", "0x2e2fdbd9", "0x2f2ff15d", "0x36568abe",
        "0x3b964cc0", "0x3ba6f26a", "0x3c6680e2", "0x4f7edf58", "0x54b0476c", "0x54fd4d50", "0x5c4bc504", "0x5d29f9f2",
        "0x5ed7ca5b", "0x6388eeb7", "0x641f5e35", "0x6a272462", "0x719f3089", "0x797669c9", "0x7b02b2c9", "0x7e15676e",
        "0x84e5eed0", "0x8c4313c1", "0x8d1e0ce6", "0x91d14854", "0x967a2a70", "0x9d55bde4", "0xa217fddf", "0xaffed0e0",
        "0xb5ac48a0", "0xb87224d0", "0xbcc4e791", "0xc4d66de8", "0xd547741f", "0xd7b3ec08", "0xd829b2ad", "0xdbde08f0",
        "0xdc3fcdc1", "0xe5f0f5cc", "0xeae8a630", "0xef7ec2e7", "0xf1464a2d", "0xf99abb9e", "0xfc847c2b", "0xfcb5c9e3"
    ];

    console.log(`Brute-forcing ${selectors.length} selectors on Portal: ${FLAP_PORTAL}`);

    const paramSets = [
        // Case 1: (token)
        coder.encode(["address"], [WISH_TOKEN]),
        // Case 2: (token, minAmountOut)
        coder.encode(["address", "uint256"], [WISH_TOKEN, 0]),
        // Case 3: (token, minAmountOut, recipient)
        coder.encode(["address", "uint256", "address"], [WISH_TOKEN, 0, deployer.address]),
        // Case 4: (token, minAmountOut, deadline)
        coder.encode(["address", "uint256", "uint256"], [WISH_TOKEN, 0, Math.floor(Date.now() / 1000) + 3600]),
        // Case 5: (minAmountOut) - assuming single token portal? (Unlikely)
        coder.encode(["uint256"], [0]),
        // Case 6: (token, recipient)
        coder.encode(["address", "address"], [WISH_TOKEN, deployer.address]),
        // Case 7: (token, amount, recipient, deadline)
        coder.encode(["address", "uint256", "address", "uint256"], [WISH_TOKEN, 0, deployer.address, Math.floor(Date.now() / 1000) + 3600]),
        // Case 8: (token, recipient, amount)
        coder.encode(["address", "address", "uint256"], [WISH_TOKEN, deployer.address, 0]),
    ];

    for (const sel of selectors) {
        for (let i = 0; i < paramSets.length; i++) {
            const params = paramSets[i].slice(2);
            const data = sel + params;

            try {
                // Pass value to simulate buy
                await hre.ethers.provider.call({
                    to: FLAP_PORTAL,
                    data: data,
                    value: AMOUNT_BNB
                });

                // If we reach here, it did not revert
                console.log(`✅ MATCH FOUND! Selector: ${sel} | Params Case: ${i + 1}`);
                console.log(`   (Data: ${data})`);
            } catch (e) {
                // Ignore
            }
        }
    }
}

main().catch(console.error);
