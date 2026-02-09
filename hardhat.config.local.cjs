require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.22",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1
            }
        }
    },
    networks: {
        hardhat: {
            chainId: 1337,
            // NO FORKING
        }
    },
    etherscan: {
        apiKey: process.env.BSCSCAN_API_KEY
    },
};
