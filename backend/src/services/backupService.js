const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Models to backup
const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const Attachment = require('../models/Attachment');
const EmailMessage = require('../models/EmailMessage');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const Role = require('../models/Role');
const ProcessedEmail = require('../models/ProcessedEmail');
const Metrics = require('../models/Metrics');
const SystemAuditLog = require('../models/SystemAuditLog');
const SystemSettings = require('../models/SystemSettings');

// Helper to copy folder recursively
function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (let entry of entries) {
    let srcPath = path.join(from, entry.name);
    let destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Helper to delete folder recursively
function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

/**
 * Execute daily system backup
 */
async function runDailyBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const projectRoot = path.resolve(__dirname, '../../');
  const backupDir = path.join(projectRoot, 'backups');
  const currentBackupFolder = path.join(backupDir, `backup-${timestamp}`);
  
  console.log(`[Backup Service] Starting daily backup at ${new Date().toISOString()}...`);
  
  try {
    // 1. Create backups folder structure
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.mkdirSync(currentBackupFolder, { recursive: true });
    
    // 2. Backup Database Collections (JSON format)
    const dbBackupDir = path.join(currentBackupFolder, 'db');
    fs.mkdirSync(dbBackupDir, { recursive: true });
    
    const collectionsToBackup = [
      { name: 'Enquiry', model: Enquiry },
      { name: 'Customer', model: Customer },
      { name: 'Attachment', model: Attachment },
      { name: 'EmailMessage', model: EmailMessage },
      { name: 'Quotation', model: Quotation },
      { name: 'User', model: User },
      { name: 'Role', model: Role },
      { name: 'ProcessedEmail', model: ProcessedEmail },
      { name: 'Metrics', model: Metrics },
      { name: 'SystemAuditLog', model: SystemAuditLog },
      { name: 'SystemSettings', model: SystemSettings }
    ];
    
    for (const col of collectionsToBackup) {
      try {
        const data = await col.model.find();
        fs.writeFileSync(
          path.join(dbBackupDir, `${col.name}.json`), 
          JSON.stringify(data, null, 2), 
          'utf8'
        );
      } catch (colErr) {
        console.error(`[Backup Service] Failed to backup collection ${col.name}:`, colErr.message);
      }
    }
    console.log('[Backup Service] Database collections successfully exported.');
    
    // 3. Backup Local File Uploads Storage
    const uploadsDir = path.join(projectRoot, 'uploads');
    const uploadsBackupDir = path.join(currentBackupFolder, 'uploads');
    
    if (fs.existsSync(uploadsDir)) {
      copyFolderSync(uploadsDir, uploadsBackupDir);
      console.log('[Backup Service] Uploads attachment storage successfully copied.');
    } else {
      console.warn('[Backup Service] No uploads directory found to backup.');
    }
    
    // Log backup event in audit log
    await SystemAuditLog.create({
      eventType: 'SYSTEM',
      action: 'DAILY_BACKUP_CREATED',
      details: `Daily backup successfully created: backup-${timestamp}`,
      metadata: { folderName: `backup-${timestamp}` }
    }).catch(() => {});
    
    console.log(`[Backup Service] Backup successfully created at: ${currentBackupFolder}`);
    
    // 4. Cleanup/Retention loop (older than 90 days or setting)
    await runRetentionCleanup(backupDir);
    
  } catch (err) {
    console.error('[Backup Service] Daily backup execution failed:', err.message, err.stack);
    
    // Log failure
    await SystemAuditLog.create({
      eventType: 'SYSTEM',
      action: 'DAILY_BACKUP_FAILED',
      details: `Daily backup failed: ${err.message}`
    }).catch(() => {});
  }
}

/**
 * Sweeps the backups folder and deletes backups older than retention policy.
 */
async function runRetentionCleanup(backupDir) {
  try {
    // Read configurable retention from system settings if available
    let retentionDays = 90;
    const settings = await SystemSettings.findOne();
    if (settings && settings.backupRetentionDays) {
      retentionDays = settings.backupRetentionDays;
    }
    
    console.log(`[Backup Service] Running retention cleanup. Policy: ${retentionDays} days.`);
    
    const folders = fs.readdirSync(backupDir);
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    
    for (const folder of folders) {
      if (folder.startsWith('backup-')) {
        const folderPath = path.join(backupDir, folder);
        const stats = fs.statSync(folderPath);
        const ageMs = now - stats.mtimeMs;
        
        if (ageMs > retentionMs) {
          console.log(`[Backup Service] Deleting expired backup folder: ${folder}`);
          deleteFolderRecursive(folderPath);
          
          await SystemAuditLog.create({
            eventType: 'SYSTEM',
            action: 'EXPIRED_BACKUP_DELETED',
            details: `Expired backup folder deleted: ${folder}`,
            metadata: { folder }
          }).catch(() => {});
        }
      }
    }
  } catch (cleanErr) {
    console.error('[Backup Service] Error running backup retention cleanup:', cleanErr.message);
  }
}

module.exports = {
  runDailyBackup
};
