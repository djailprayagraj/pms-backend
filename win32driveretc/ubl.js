const fs = require('fs');
const path = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

try {
    let content = fs.readFileSync(path, 'utf8');
    
    // Split into lines and filter out any line containing the target domain
    const lines = content.split(/\r?\n/);
    const filteredLines = lines.filter(line => !line.includes('allahabadhighcourt.in'));

    if (lines.length === filteredLines.length) {
        console.log('⚠️ The site was not found in your hosts file (already unblocked).');
        return;
    }

    // Write the cleaned lines back
    fs.writeFileSync(path, filteredLines.join('\r\n'), 'utf8');
    
    console.log('🔓 Site unblocked successfully!');
    console.log('Run "ipconfig /flushdns" in your terminal to apply changes.');
} catch (err) {
    console.error('❌ Error: Make sure you are running your terminal as Administrator!', err.message);
}