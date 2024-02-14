import * as fs from 'fs';
import { Command } from 'commander';
import prettyMilliseconds from 'pretty-ms';


const program = new Command();
program
    .name('Epostolary Report')
    .description('Output general stats about a message correspondence')
    .argument('<filename>', 'input message JSON file')
    .showHelpAfterError()
    .action(main);

function main(filename, options) {
    if (!fs.existsSync(filename)) {
        program.error(`File ${filename} does not exist`)
    }

    let fileData;
    try {
        const fileString = fs.readFileSync(filename, {encoding: 'latin1'});
        fileData = JSON.parse(fileString);
    } catch (error) {
       program.error(`Error parsing JSON in ${filename}`);
    }

    processData(fileData);
}
function processData(data) {
    processInstagramData(data);
}

function processInstagramData(data) {
    const stats = { participants: {} }
    data.messages.sort((a,b) => a.timestamp_ms - b.timestamp_ms);


    data.messages.forEach((message, i) => {
        const participantStats = stats.participants[message.sender_name] ?? 
            {
                count: 0,
                lengthSum: 0,
                lengthAve: 0,
                englishCount: 0,
                englishPercentage: 0,
                smileCount: 0,
                sharesCount: 0,
                likeCount: 0,
                reactionTimeCount: 0,
                reactionTimeSumMs: 0,
                reactionTimeAveMs: 0,
            };
        stats.participants[message.sender_name] = participantStats;

        if (/^(Reacted|Liked) .* message\s?$/.test(message.content)) {
            // Skip this message
            return;
        }

        participantStats.count++;
        message.share     ?? participantStats.sharesCount++;
        message.reactions && message.reactions.forEach(r => stats.participants[r.actor].likeCount++)

        if (message.content) {
            participantStats.lengthSum += message.content.length;

            // Assume that a bunch of Unicode chars is not english
            /[^\u0000-\u007F]{10,}/.test(message.content) || participantStats.englishCount++;
            /\w+\)/.test(message.content)           && participantStats.smileCount++;
        }

        if (i > 0) {
            const prevMessage = data.messages[i-1];

            // Identify the instance of a reply to another's previous message
            if (prevMessage.sender_name != message.sender_name) {
                participantStats.reactionTimeCount++;
                participantStats.reactionTimeSumMs += message.timestamp_ms - prevMessage.timestamp_ms;
            }
        }
    });

    const participants = data.participants.map(p => p.name);

    // Final processing
    participants.forEach(p => {
        const participantStats = stats.participants[p];
        participantStats.lengthAve = participantStats.lengthSum / participantStats.count;
        participantStats.reactionTimeAveMs = participantStats.reactionTimeSumMs / participantStats.reactionTimeCount;
        participantStats.reactionTimeAve = prettyMilliseconds(participantStats.reactionTimeAveMs);

        participantStats.englishPercentage = participantStats.englishCount / participantStats.count;
    });
    
    console.log(JSON.stringify(stats, null, 2));
}

program.parse();
