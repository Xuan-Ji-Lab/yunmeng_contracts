const { ethers } = require("hardhat");

async function main() {
    const user = "0x4d1CD4c6f9c75Be993bCe42e254AD73fbb121D36"; // Failing user
    console.log(`Checking code size for: ${user}`);

    const code = await ethers.provider.getCode(user);
    if (code === "0x") {
        console.log("User is an EOA (Externally Owned Account)");
    } else {
        console.log("User is a Contract! Code length:", code.length);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
