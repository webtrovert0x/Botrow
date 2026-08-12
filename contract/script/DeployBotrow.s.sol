// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Botrow.sol";

contract DeployBotrowScript is Script {
    function run() external {
        address payable feeRecipient = payable(vm.envAddress("FEE_RECIPIENT"));
        address arbitrator = vm.envAddress("ARBITRATOR");

        // By invoking startBroadcast() without arguments, Foundry flexibly utilizes the --private-key flag supplied via CLI
        vm.startBroadcast();

        Botrow escrow = new Botrow(feeRecipient, arbitrator);
        
        console.log("----------------------------------------------------------");
        console.log("Botrow decentralized escrow deployed successfully to:", address(escrow));
        console.log("Protocol Fee Recipient:", feeRecipient);
        console.log("Designated Arbitrator:", arbitrator);
        console.log("----------------------------------------------------------");

        vm.stopBroadcast();
    }
}
