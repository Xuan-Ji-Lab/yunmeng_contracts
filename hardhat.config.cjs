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
                runs: 200,
            },
            viaIR: true,
        }
    },
    networks: {
        hardhat: {
            chainId: 1337,
            forking: {
                url: "https://bsc-dataseed3.binance.org/",
            }
        },
        bscTestnet: {
            url: "https://bsc-testnet.publicnode.com", // Use the one that works in frontend
            chainId: 97,
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [`0x${process.env.DEPLOYER_PRIVATE_KEY.replace(/^0x/, '')}`]
                : [],
            gasPrice: 5000000000, // 5 gwei
        },
        bscMainnet: {
            url: "https://bsc-dataseed.binance.org/",
            chainId: 56,
            accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
            gasPrice: 5000000000, // 5 gwei 
        }

    },
    etherscan: {
        apiKey: process.env.BSCSCAN_API_KEY,
        customChains: [
            {
                network: "bscTestnet",
                chainId: 97,
                urls: {
                    apiURL: "https://api-testnet.bscscan.com/api",
                    browserURL: "https://testnet.bscscan.com"
                }
            }
        ]
    },
};
