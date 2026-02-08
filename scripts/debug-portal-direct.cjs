const hre = require("hardhat");

async function main() {
    const PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9"; // Flap Portal
    const WISH = "0x00050c0d05b0f852c44aef369f188764fd417777";
    const [deployer] = await hre.ethers.getSigners();

    // Params
    const tokenIn = hre.ethers.ZeroAddress;
    const tokenOut = WISH;
    const amountIn = hre.ethers.parseEther("0.0001");
    const amountOutMin = 0;
    const data = "0x";

    // Struct: (tokenIn, tokenOut, amountIn, minOut, data)
    const tuple = [tokenIn, tokenOut, amountIn, amountOutMin, data];
    const abiCoder = new hre.ethers.AbiCoder();
    const encodedParams = abiCoder.encode(
        ["tuple(address,address,uint256,uint256,bytes)"],
        [tuple]
    );

    const selector = "0xef7ec2e7";
    const calldata = selector + encodedParams.slice(2);

    console.log(`Direct calling Portal ${PORTAL}...`);
    console.log("Calldata:", calldata);

    try {
        const ret = await hre.ethers.provider.call({
            to: PORTAL,
            value: amountIn,
            data: calldata,
            from: deployer.address
        });
        console.log("✅ Call Success! Output:", ret);
    } catch (e) {
        console.log("❌ Call Failed!");
        if (e.data) {
            console.log("Revert Data:", e.data);
            // Decode
            try {
                // If Error(string)
                if (e.data.startsWith("0x08c379a0")) {
                    const reason = abiCoder.decode(["string"], "0x" + e.data.slice(10));
                    console.log("Reason:", reason[0]);
                } else {
                    console.log("Unknown Custom Error");
                }
            } catch { }
        } else {
            console.log("Msg:", e.message);
        }
    }
}

main().catch(console.error);
