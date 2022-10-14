
const axios = require('axios');
const fs = require('fs');
const steam = require('steamidconvert')();

const api = 'http://logs.tf/api/v1/log/';

const calculatePlayerStats = async () => {
    const logs = JSON.parse(fs.readFileSync('./matchLogs.json', 'utf8'));
    let playerStats = {};

    let logData = [];
    const startTime = new Date().getTime();
    console.log(`Processing logs...`);
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

                let playerAlias = log.names[playerKey];

                if (!playerStats[currentClass.type][playerKey]) {
                    playerStats[currentClass.type][playerKey] = {
                        /*steam64id: convertSteamId3ToSteamId64(playerKey),*/
                        steam3id: playerKey,
                        aliases: playerAlias,
                        kills: currentClass.kills,
                        deaths: currentClass.deaths,
                        assists: currentClass.assists,
                        avgDpm: (currentClass.dmg / (currentClass.total_time / 60)).toFixed(2),
                        avgDtm: (log.players[playerKey].dt / (currentClass.total_time / 60)).toFixed(2),
                        deltaDmg: ((currentClass.dmg / (currentClass.total_time / 60)).toFixed(2) - (log.players[playerKey].dt / (currentClass.total_time / 60)).toFixed(2)).toFixed(2),
                        "K/D": (currentClass.kills / currentClass.deaths).toFixed(2),
                        "KA/D": ((currentClass.kills + currentClass.assists) / currentClass.deaths).toFixed(2),
                        "K/30": (currentClass.kills / (currentClass.total_time / 60) * 30).toFixed(2),
                        "D/30": (currentClass.deaths / (currentClass.total_time / 60) * 30).toFixed(2),
                        totalDamageTaken: log.players[playerKey].dt,
                        totalDamage: currentClass.dmg,
                        totalTime: currentClass.total_time,
                        logs: (log.logId).toString(),
                    }

                    if (currentClass.type === 'medic') {
                        playerStats[currentClass.type][playerKey].ubers = log.players[playerKey].ubers;
                        playerStats[currentClass.type][playerKey].totalHealing = log.players[playerKey].heal;
                        playerStats[currentClass.type][playerKey].drops = log.players[playerKey].drops;
                        playerStats[currentClass.type][playerKey].avgHpm = (log.players[playerKey].heal / (currentClass.total_time / 60)).toFixed(2);
                        playerStats[currentClass.type][playerKey]["Ubers/30"] = (log.players[playerKey].ubers / (currentClass.total_time / 60) * 30).toFixed(2);
                        playerStats[currentClass.type][playerKey]["Drops/30"] = (log.players[playerKey].drops / (currentClass.total_time / 60) * 30).toFixed(2);
                    }
                    if (currentClass.type === 'scout' || currentClass.type === 'soldier') {
                        calculateRole(playerKey, currentClass, log, playerStats);
                    }
                } else {
                    playerStats[currentClass.type][playerKey].kills += currentClass.kills;
                    playerStats[currentClass.type][playerKey].deaths += currentClass.deaths;
                    playerStats[currentClass.type][playerKey].assists += currentClass.assists;
                    playerStats[currentClass.type][playerKey].totalDamage += currentClass.dmg;
                    playerStats[currentClass.type][playerKey].totalDamageTaken += log.players[playerKey].dt;
                    playerStats[currentClass.type][playerKey].totalTime += currentClass.total_time;

                    let { totalDamage, totalDamageTaken, totalTime } = playerStats[currentClass.type][playerKey];
                    playerStats[currentClass.type][playerKey].avgDpm = (totalDamage / (totalTime / 60)).toFixed(2);
                    playerStats[currentClass.type][playerKey].avgDtm = (totalDamageTaken / (totalTime / 60)).toFixed(2);
                    playerStats[currentClass.type][playerKey].deltaDmg = (totalDamage / (totalTime / 60) - (totalDamageTaken / (totalTime / 60))).toFixed(2);

                    let { kills, assists, deaths } = playerStats[currentClass.type][playerKey];
                    playerStats[currentClass.type][playerKey]["K/D"] = (kills / deaths).toFixed(2);
                    playerStats[currentClass.type][playerKey]["KA/D"] = ((kills + assists) / deaths).toFixed(2);
                    playerStats[currentClass.type][playerKey]["K/30"] = (kills / (totalTime / 60) * 30).toFixed(2);
                    playerStats[currentClass.type][playerKey]["D/30"] = (deaths / (totalTime / 60) * 30).toFixed(2);

                    if (currentClass.type === 'medic') {
                        playerStats[currentClass.type][playerKey].ubers += log.players[playerKey].ubers;
                        playerStats[currentClass.type][playerKey].totalHealing += log.players[playerKey].heal;
                        playerStats[currentClass.type][playerKey].drops += log.players[playerKey].drops;

                        let { totalHealing, ubers, drops } = playerStats[currentClass.type][playerKey];
                        playerStats[currentClass.type][playerKey].avgHpm = (totalHealing / (totalTime / 60)).toFixed(2);
                        playerStats[currentClass.type][playerKey]["Ubers/30"] = (ubers / (totalTime / 60) * 30).toFixed(2);
                        playerStats[currentClass.type][playerKey]["Drops/30"] = (drops / (totalTime / 60) * 30).toFixed(2);
                    }

                    if (currentClass.type === 'scout' || currentClass.type === 'soldier') {
                        calculateRole(playerKey, currentClass, log, playerStats);
                    }

                    let aliases = playerStats[currentClass.type][playerKey].aliases.split(', ');
                    if (!aliases.includes(playerAlias)) {
                        playerStats[currentClass.type][playerKey].aliases += `, ${playerAlias}`;
                    }

                    playerStats[currentClass.type][playerKey].logs += `, ${log.logId}`;
                    if (!playerStats[currentClass.type][playerKey].aliases[playerAlias]) {
                        playerStats[currentClass.type][playerKey].aliases[playerAlias] = playerAlias;
                    }
                }
            }
        }
    }

    fs.writeFile('./totalPlayerStats.json', JSON.stringify(playerStats, null, 2), err => {
        if (err) throw err;
    })
}

const calculateRole = (playerKey, currentClass, log, playerStats) => {
    for (const partnerKey in log.players) {
        let classPartner = log.players[partnerKey];
        if (partnerKey === playerKey || log.players[playerKey].team !== classPartner.team) {
            continue;
        }

        if (!playerStats[currentClass.type][playerKey].comboLogs)
            playerStats[currentClass.type][playerKey].comboLogs = 0;
        if (!playerStats[currentClass.type][playerKey].flankLogs)
            playerStats[currentClass.type][playerKey].flankLogs = 0;

        for (const teammateClass of classPartner.class_stats) {
            if (currentClass.type === teammateClass.type) {
                if (log.players[playerKey].hr > classPartner.hr) {
                    playerStats[currentClass.type][playerKey].comboLogs += 1;
                } else {
                    playerStats[currentClass.type][playerKey].flankLogs += 1;
                }
                break;
            }
        }
    }

    let { flankLogs, comboLogs } = playerStats[currentClass.type][playerKey];
    if (currentClass.type === 'soldier') {
        playerStats[currentClass.type][playerKey].role = (comboLogs >= flankLogs) ? 'pocket' : 'roamer';
        if (comboLogs === flankLogs) playerStats[currentClass.type][playerKey].role = '?';
    } else {
        playerStats[currentClass.type][playerKey].role = (comboLogs >= flankLogs) ? 'combo' : 'flank';
        if (comboLogs === flankLogs)
            playerStats[currentClass.type][playerKey].role = '?';
    }
}

const calculateMedicValues = async () => {
    const medics = JSON.parse(fs.readFileSync('./medics.json', 'utf8'));
    let medicStats = {};

    // Loop through each medic and get their logs/stats
    for (const [medic, medicData] of Object.entries(medics.medics)) {
        const medicId = convertSteamId64ToSteamId3(medicData.rglId);

        let logs = [];
        for (const matchId of medicData.matchLogs) {
            try {
                let logData = await getLogData(matchId);
                logs.push(logData);
                await new Promise(r => setTimeout(r, 100));
            } catch (error) {
                console.error(error.message);
            }
        }

        medicStats[medic] = getMedicStats(logs, medicId);
    }

    // Write stats to file
    fs.writeFile('./medicStats.json', JSON.stringify(medicStats, null, 2), err => {
        if (err) throw err;
    })
}

const getLogData = async (logId) => {
    const logData = (await axios.get(api + logId)).data;
    
    return logData;
}

const getMedicStats = (logs, medicId) => {
    let deaths = 0;
    let ubers = 0;
    let drops = 0;
    let hpm = 0;

    for (const log of logs) {
        deaths += (log.players[medicId].deaths / (log.length / 60) * 30);
        ubers += (log.players[medicId].ubers / (log.length / 60) * 30);
        drops += (log.players[medicId].drops / (log.length / 60) * 30);
        hpm += (log.players[medicId].heal / (log.length / 60));
    }

    return {
        medicId,
        "hpm": (hpm / logs.length).toFixed(2),
        "drops": (drops / logs.length).toFixed(2),
        "ubers": (ubers / logs.length).toFixed(2),
        "deaths": (deaths / logs.length).toFixed(2),
    }
}

const convertSteamId64ToSteamId3 = (steamId64) => {
    let steamId = steam.convertToText(steamId64);
    return steam.convertToNewFormat(steamId);
}

const convertSteamId3ToSteamId64 = (steamId3) => {
    return steam.convertTo64(steamId3);
}

//calculateMedicValues();
calculatePlayerStats();