const hre = require("hardhat");

async function main() {
    const ROUTER_IMPL = "0x2108c0c5087486bebefc53c0f5a257e33d875068";
    console.log("Extracting strings from:", ROUTER_IMPL);

    const code = await hre.ethers.provider.getCode(ROUTER_IMPL);
    const buffer = Buffer.from(code.slice(2), "hex");

    let currentString = "";
    const strings = [];

    for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        if (byte >= 32 && byte <= 126) {
            currentString += String.fromCharCode(byte);
        } else {
            if (currentString.length >= 4) {
                strings.push(currentString);
            }
            currentString = "";
        }
    }

    console.log("Found Strings:");
    strings.forEach(s => console.log(s));
}

main().catch(console.error);
