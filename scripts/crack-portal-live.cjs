const hre = require("hardhat");

async function main() {
    const PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9";
    const TARGET = "0xef7ec2e7";
    const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
    const WISH = "0x00050c0d05b0f852c44aef369f188764fd417777";
    const [deployer] = await hre.ethers.getSigners();
    const AMOUNT = hre.ethers.parseEther("0.0001");

    let coder;
    if (hre.ethers.AbiCoder) coder = new hre.ethers.AbiCoder();
    else coder = hre.ethers.utils.defaultAbiCoder;

    console.log(`Live Cracking Portal ${TARGET}...`);

    // Construct V3 Path: WBNB -> 3000 -> WISH
    // Fee 3000 = 0x000bb8
    // Pack: Address(20) + Fee(3) + Address(20)
    const pathV3 = hre.ethers.solidityPacked(
        ["address", "uint24", "address"],
        [WBNB, 3000, WISH]
    );
    console.log("V3 Path:", pathV3);

    // Verify standard revert
    const logError = (e, desc) => {
        if (e.data) console.log(`[${desc}] Reverted with Data: ${e.data}`);
        else console.log(`[${desc}] Reverted: ${e.message}`);
    };

    // Scenario 1: ExactInput((tokenIn, amountIn, amountOutMin, path, recipient))
    // Note: If sending ETH, tokenIn might be WBNB or ZeroAddress?
    const s1_types = ["tuple(address,uint256,uint256,bytes,address)"];
    const s1_params = [[WBNB, AMOUNT, 0, pathV3, deployer.address]];
    const d1 = TARGET + coder.encode(s1_types, s1_params).slice(2);

    try {
        await hre.ethers.provider.call({ to: PORTAL, data: d1, value: AMOUNT });
        console.log("✅ SUCCESS: Scenario 1 (ExactInput tuple with V3 Path)");
    } catch (e) { logError(e, "Scenario 1"); }

    // Scenario 2: ExactInput((path, recipient, deadline, amountIn, amountOutMinimum)) (Standard V3)
    // Sig: exactInput((bytes,address,uint256,uint256,uint256)) -> 0xb858183f (Not ef7ec2e7)
    // But maybe specific param order?

    // Scenario 3: Flat Params (tokenIn, amountIn, minOut, path, recipient)
    const s3_types = ["address", "uint256", "uint256", "bytes", "address"];
    const s3_params = [WBNB, AMOUNT, 0, pathV3, deployer.address];
    const d3 = TARGET + coder.encode(s3_types, s3_params).slice(2);
    try {
        await hre.ethers.provider.call({ to: PORTAL, data: d3, value: AMOUNT });
        console.log("✅ SUCCESS: Scenario 3 (Flat Params with V3 Path)");
    } catch (e) { logError(e, "Scenario 3"); }

    // Scenario 4: Swap(path, minOut, recipient)? 
    // Maybe simpler?

    // Scenario 5: Use ZeroAddress for TokenIn (ETH)
    const s5_params = [[hre.ethers.ZeroAddress, AMOUNT, 0, pathV3, deployer.address]];
    const d5 = TARGET + coder.encode(s1_types, s5_params).slice(2);
    try {
        await hre.ethers.provider.call({ to: PORTAL, data: d5, value: AMOUNT });
        console.log("✅ SUCCESS: Scenario 5 (Tuple with ZeroAddress)");
    } catch (e) { logError(e, "Scenario 5"); }
}

main().catch(console.error);
