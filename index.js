
const axios = require('axios');
const fs = require('fs');
const glob = require("glob");
const api = 'http://logs.tf/api/v1/log/';

const calculatePlayerStats = async (logsFilePath) => {
    const logs = JSON.parse(fs.readFileSync(logsFilePath, 'utf8'));
    let playerStats = {};

    let logData = [];
    const startTime = new Date().getTime();
    console.log(`Processing logs for ${logsFilePath}...`);
    for (const matchId of logs.logs) {
        try {
            let currentLogData = getLogData(matchId);
            currentLogData.then(result => {
                result.logId = matchId;
            });
            logData.push(currentLogData);
            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            console.error(error.message);
        }
    }

    logData = await Promise.all(logData);
    console.log(`Finished processing logs... Took ${(new Date().getTime() - startTime) / 1000} seconds`)

    for (const log of logData) {
        for (const playerKey in log.players) {
            let currentPlayerStats = log.players[playerKey].class_stats;
            for (const currentClass of currentPlayerStats) {
                if (!playerStats[currentClass.type]) {
                    playerStats[currentClass.type] = {};
                }

                if (!playerStats[currentClass.type][playerKey]) {
                    playerStats[currentClass.type][playerKey] = getPlayerStats(playerKey, currentClass, log);
                } else {
                    playerStats[currentClass.type][playerKey] = updatePlayerStats(playerKey, playerStats[currentClass.type][playerKey], currentClass, log);
                }
            }
        }
    }

    let outputFilePath = logsFilePath.split('.')[1];
    console.log(outputFilePath);
    fs.writeFile(`./${outputFilePath}_output.json`, JSON.stringify(playerStats, null, 2), err => {
        if (err) throw err;
    })
}

/**
 * Helper function to construct the initial compiled stats for a player. Specific to each class.
 * 
 * @param {*} playerKey The key for the player
 * @param {*} currentClass A single specific class stats from the log
 * @param {*} log The entire log
 * @returns 
 */
const getPlayerStats = (playerKey, currentClass, log) => {
    let playerAlias = log.names[playerKey];
    const { kills, deaths, assists, dmg, total_time} = currentClass;
    const dt = log.players[playerKey].dt;

    let player = {
        /*steam64id: convertSteamId3ToSteamId64(playerKey),*/
        steam3id: playerKey,
        aliases: playerAlias,
        kills,
        deaths,
        assists,
        avgDpm: (dmg / (total_time / 60)).toFixed(2),
        avgDtm: (dt / (total_time / 60)).toFixed(2),
        deltaDmg: ((dmg / (total_time / 60)).toFixed(2) - (dt / (total_time / 60)).toFixed(2)).toFixed(2),
        "K/D": (currentClass.kills / currentClass.deaths).toFixed(2),
        "KA/D": ((kills + assists) / deaths).toFixed(2),
        "K/30": (kills / (total_time / 60) * 30).toFixed(2),
        "D/30": (deaths / (total_time / 60) * 30).toFixed(2),
        totalDamageTaken: dt,
        totalDamage: dmg,
        totalTime: total_time,
        logs: (log.logId).toString(),
    }

    if (currentClass.type === 'medic') {
        player.ubers = log.players[playerKey].ubers;
        player.totalHealing = log.players[playerKey].heal;
        player.drops = log.players[playerKey].drops;
        player.avgHpm = (log.players[playerKey].heal / (currentClass.total_time / 60)).toFixed(2);
        player["Ubers/30"] = (log.players[playerKey].ubers / (currentClass.total_time / 60) * 30).toFixed(2);
        player["Drops/30"] = (log.players[playerKey].drops / (currentClass.total_time / 60) * 30).toFixed(2);
    }
    if (currentClass.type === 'scout' || currentClass.type === 'soldier') {
        player = calculateRole(playerKey, player, currentClass, log);
    }

    return player;
}

const updatePlayerStats = (playerKey, player, currentClass, log) => {
    const playerAlias = log.names[playerKey];
    const dt = log.players[playerKey].dt;

    player.kills += currentClass.kills;
    player.deaths += currentClass.deaths;
    player.assists += currentClass.assists;
    player.totalDamage += currentClass.dmg;
    player.totalDamageTaken += dt;
    player.totalTime += currentClass.total_time;

    let { totalDamage, totalDamageTaken, totalTime, kills, assists, deaths } = player;

    player.avgDpm = (totalDamage / (totalTime / 60)).toFixed(2);
    player.avgDtm = (totalDamageTaken / (totalTime / 60)).toFixed(2);
    player.deltaDmg = (totalDamage / (totalTime / 60) - (totalDamageTaken / (totalTime / 60))).toFixed(2);
    player["K/D"] = (kills / deaths).toFixed(2);
    player["KA/D"] = ((kills + assists) / deaths).toFixed(2);
    player["K/30"] = (kills / (totalTime / 60) * 30).toFixed(2);
    player["D/30"] = (deaths / (totalTime / 60) * 30).toFixed(2);

    
    if (currentClass.type === 'medic') {
        player = updateMedicStats(player, log.players[playerKey]);
    }

    if (currentClass.type === 'scout' || currentClass.type === 'soldier') {
        player = calculateRole(playerKey, player, currentClass, log);
    }

    let aliases = player.aliases.split(', ');
    if (!aliases.includes(playerAlias)) {
        player.aliases += `, ${playerAlias}`;
    }

    player.logs += `, ${log.logId}`;
    if (!player.aliases[playerAlias]) {
        player.aliases[playerAlias] = playerAlias;
    }

    return player;
}

const updateMedicStats = (player, playerStats) => {
    player.ubers += playerStats.ubers;
    player.totalHealing += playerStats.heal;
    player.drops += playerStats.drops;

    let { totalTime, totalHealing, ubers, drops } = player;
    player.avgHpm = (totalHealing / (totalTime / 60)).toFixed(2);
    player["Ubers/30"] = (ubers / (totalTime / 60) * 30).toFixed(2);
    player["Drops/30"] = (drops / (totalTime / 60) * 30).toFixed(2);
    
    return player;
}

const calculateRole = (playerKey, player, currentClass, log) => {
    for (const partnerKey in log.players) {
        let classPartner = log.players[partnerKey];
        if (partnerKey === playerKey || log.players[playerKey].team !== classPartner.team) {
            continue;
        }

        if (!player.comboLogs)
            player.comboLogs = 0;
        if (!player.flankLogs)
            player.flankLogs = 0;

        for (const teammateClass of classPartner.class_stats) {
            if (currentClass.type === teammateClass.type) {
                if (log.players[playerKey].hr > classPartner.hr) {
                    player.comboLogs += 1;
                } else if (log.players[playerKey].hr < classPartner.hr) {
                    player.flankLogs += 1;
                }
                break;
            }
        }
    }

    let { flankLogs, comboLogs } = player;
    if (currentClass.type === 'soldier') {
        player.role = (comboLogs >= flankLogs) ? 'pocket' : 'roamer';
        if (comboLogs === flankLogs) player.role = '?';
    } else {
        player.role = (comboLogs >= flankLogs) ? 'combo' : 'flank';
        if (comboLogs === flankLogs)
            player.role = '?';
    }

    return player;
}

const getLogData = async (logId) => {
    return (await axios.get(api + logId)).data;
}

const files = glob.sync('rglLogs/**/**/*Logs.json');
files.forEach(file => {
    calculatePlayerStats(`./${file}`);
});