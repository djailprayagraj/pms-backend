const fs = require('fs');
const path = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

const entriesToBlock = [
    '127.0.0.1 www.allahabadhighcourt.in',
    '127.0.0.1 allahabadhighcourt.in'
];

try {
    let content = fs.readFileSync(path, 'utf8');
    
    // Check if already blocked
    const alreadyBlocked = entriesToBlock.every(entry => content.includes(entry));
    if (alreadyBlocked) {
        console.log('⚠️ The site is already blocked.');
        return;
    }

    // Append entries
    const blockBlock = '\n' + entriesToBlock.join('\n') + '\n';
    fs.appendFileSync(path, blockBlock, 'utf8');
    
    console.log('🔒 Site blocked successfully!');
    console.log('Run "ipconfig /flushdns" in your terminal to apply changes.');
} catch (err) {
    console.error('❌ Error: Make sure you are running your terminal as Administrator!', err.message);
}