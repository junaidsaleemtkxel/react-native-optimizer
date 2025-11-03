import fs from 'fs';
import path from 'path';
import { OptimizerResult } from './index';

export function generateHtmlReport(result: OptimizerResult, projectPath: string, outputPath?: string): string {
  const reportPath = outputPath || path.join(projectPath, 'optimizer-report.html');
  const projectName = path.basename(projectPath);
  
  // Calculate summary statistics
  const totalIssues = result.unusedImports.length + result.unusedFiles.length;
  const totalWastedSize = result.unusedFiles.reduce((sum, file) => sum + file.size, 0);
  const totalUnusedImports = result.unusedImports.reduce((sum, item) => sum + item.imports.length, 0);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React Native Optimizer Report - ${projectName}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" fill="rgba(255,255,255,0.1)"><polygon points="0,0 1000,0 1000,100 0,30"/></svg>') no-repeat center bottom;
            background-size: cover;
        }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            position: relative;
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
            position: relative;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            padding: 20px;
            background: #f8fafc;
        }
        
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.2s ease;
        }
        
        .summary-card:hover {
            transform: translateY(-5px);
        }
        
        .summary-card .icon {
            font-size: 2rem;
            margin-bottom: 8px;
        }
        
        .summary-card .number {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .summary-card .label {
            color: #64748b;
            font-weight: 500;
            font-size: 0.9rem;
        }
        
        .success { color: #10b981; }
        .warning { color: #f59e0b; }
        .error { color: #ef4444; }
        .info { color: #3b82f6; }
        
        .section {
            padding: 25px 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .section:last-child {
            border-bottom: none;
        }
        
        .section h2 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 20px;
            color: #1e293b;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .chart-container {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            height: 300px;
        }
        
        .chart-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 15px;
            text-align: center;
            color: #374151;
        }
        
        .file-list {
            background: #f8fafc;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .file-item {
            padding: 15px;
            border-bottom: 1px solid #e2e8f0;
            background: white;
            margin-bottom: 1px;
        }
        
        .file-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .file-path {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .file-meta {
            display: flex;
            gap: 20px;
            font-size: 0.85rem;
            color: #64748b;
        }
        
        .imports-list {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
        }
        
        .import-tag {
            display: inline-block;
            background: #fef3c7;
            color: #92400e;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            margin: 2px;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #64748b;
        }
        
        .empty-state .icon {
            font-size: 3rem;
            margin-bottom: 15px;
        }
        
        .suggestions {
            background: linear-gradient(135deg, #e0f2fe 0%, #e1f5fe 100%);
            padding: 30px;
            border-radius: 8px;
            margin-top: 20px;
        }
        
        .suggestions h3 {
            color: #0277bd;
            margin-bottom: 15px;
            font-size: 1.3rem;
        }
        
        .suggestion-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 4px solid #0288d1;
        }
        
        .footer {
            background: #1e293b;
            color: white;
            text-align: center;
            padding: 30px;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .charts-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            
            .chart-container {
                height: 250px;
            }
            
            .summary-grid {
                grid-template-columns: repeat(2, 1fr);
                padding: 15px;
                gap: 10px;
            }
            
            .summary-card {
                padding: 15px;
            }
            
            .header {
                padding: 20px 15px;
            }
            
            .header h1 {
                font-size: 1.8rem;
            }
            
            .header p {
                font-size: 1rem;
            }
            
            .section {
                padding: 15px;
            }
            
            .file-item {
                padding: 12px;
            }
        }
        
        @media (max-width: 480px) {
            .summary-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🚀 Optimizer Report</h1>
            <p>Project: <strong>${projectName}</strong> • Generated: ${result.reportGeneratedAt.toLocaleString()}</p>
        </div>
        
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <div class="icon">📊</div>
                <div class="number info">${result.projectStats.totalFiles}</div>
                <div class="label">Files Analyzed</div>
            </div>
            <div class="summary-card">
                <div class="icon">⚠️</div>
                <div class="number warning">${result.unusedImports.length}</div>
                <div class="label">Files with Unused Imports</div>
            </div>
            <div class="summary-card">
                <div class="icon">🗑️</div>
                <div class="number error">${result.unusedFiles.length}</div>
                <div class="label">Unused Files</div>
            </div>
            <div class="summary-card">
                <div class="icon">💾</div>
                <div class="number info">${formatBytes(result.projectStats.totalSize)}</div>
                <div class="label">Total Project Size</div>
            </div>
        </div>
        
        <!-- Charts Section -->
        <div class="section">
            <h2>📈 Analysis Overview</h2>
            <div class="charts-grid">
                <div class="chart-container">
                    <div class="chart-title">Issues Distribution</div>
                    <canvas id="issuesChart" width="400" height="300"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title">Project Health Score</div>
                    <canvas id="healthChart" width="400" height="300"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Unused Imports Section -->
        <div class="section">
            <h2>⚠️ Unused Imports (${result.unusedImports.length} files)</h2>
            ${result.unusedImports.length > 0 ? `
                <div class="file-list">
                    ${result.unusedImports.slice(0, 50).map(item => `
                        <div class="file-item">
                            <div class="file-path">📄 ${item.file}</div>
                            <div class="imports-list">
                                ${item.imports.slice(0, 10).map(imp => `<span class="import-tag">${imp}</span>`).join('')}
                                ${item.imports.length > 10 ? `<span class="import-tag">...and ${item.imports.length - 10} more</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                    ${result.unusedImports.length > 50 ? `
                        <div style="text-align: center; padding: 15px; background: #f3f4f6; color: #6b7280; font-size: 0.9rem;">
                            Showing first 50 files. Total: ${result.unusedImports.length} files with unused imports.
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="empty-state">
                    <div class="icon success">✅</div>
                    <p>Excellent! No unused imports found in your project.</p>
                </div>
            `}
        </div>
        
        <!-- Unused Files Section -->
        <div class="section">
            <h2>🗑️ Unused Files (${result.unusedFiles.length} files)</h2>
            ${result.unusedFiles.length > 0 ? `
                <div class="file-list">
                    ${result.unusedFiles.slice(0, 100).map(file => `
                        <div class="file-item">
                            <div class="file-path">📄 ${file.path}</div>
                            <div class="file-meta">
                                <span>📦 ${formatBytes(file.size)}</span>
                                <span>📏 ${file.lines} lines</span>
                            </div>
                        </div>
                    `).join('')}
                    ${result.unusedFiles.length > 100 ? `
                        <div style="text-align: center; padding: 15px; background: #fef2f2; color: #991b1b; font-size: 0.9rem;">
                            Showing first 100 files. Total: ${result.unusedFiles.length} unused files.
                        </div>
                    ` : ''}
                </div>
                <p style="margin-top: 15px; padding: 15px; background: #fef2f2; border-radius: 6px; color: #991b1b; font-size: 0.95rem;">
                    <strong>💡 Potential savings:</strong> ${formatBytes(totalWastedSize)} of disk space could be reclaimed by removing these unused files.
                </p>
            ` : `
                <div class="empty-state">
                    <div class="icon success">✅</div>
                    <p>Great! No unused files detected in your project.</p>
                </div>
            `}
        </div>
        
        <!-- Suggestions -->
        ${result.suggestions.length > 0 ? `
            <div class="section">
                <div class="suggestions">
                    <h3>💡 Optimization Suggestions</h3>
                    ${result.suggestions.map(suggestion => `
                        <div class="suggestion-item">${suggestion}</div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <!-- Footer -->
        <div class="footer">
            <p>Generated by React Native Optimizer • Analysis completed in ${result.projectStats.analysisTime}ms</p>
        </div>
    </div>
    
    <script>
        // Format bytes helper
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
        
        // Issues Distribution Chart
        const issuesCtx = document.getElementById('issuesChart').getContext('2d');
        new Chart(issuesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Clean Files', 'Files with Unused Imports', 'Unused Files'],
                datasets: [{
                    data: [
                        ${result.projectStats.totalFiles - result.unusedImports.length - result.unusedFiles.length},
                        ${result.unusedImports.length},
                        ${result.unusedFiles.length}
                    ],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                    hoverBackgroundColor: ['#059669', '#d97706', '#dc2626']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 800,
                    animateRotate: true,
                    animateScale: false
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
        
        // Health Score Chart
        const healthScore = Math.max(0, Math.min(100, 
            100 - ((${totalIssues} / ${result.projectStats.totalFiles}) * 100)
        ));
        
        const healthCtx = document.getElementById('healthChart').getContext('2d');
        new Chart(healthCtx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [healthScore, 100 - healthScore],
                    backgroundColor: [
                        healthScore > 80 ? '#10b981' : healthScore > 60 ? '#f59e0b' : '#ef4444',
                        '#e5e7eb'
                    ],
                    borderWidth: 0,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                animation: {
                    duration: 1000,
                    animateRotate: true,
                    animateScale: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw: function(chart) {
                    const ctx = chart.ctx;
                    const centerX = chart.width / 2;
                    const centerY = chart.height / 2;
                    
                    ctx.save();
                    ctx.font = 'bold 28px system-ui';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = healthScore > 80 ? '#10b981' : healthScore > 60 ? '#f59e0b' : '#ef4444';
                    ctx.fillText(Math.round(healthScore) + '%', centerX, centerY);
                    
                    ctx.font = '12px system-ui';
                    ctx.fillStyle = '#6b7280';
                    ctx.fillText('Health Score', centerX, centerY + 25);
                    ctx.restore();
                }
            }]
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(reportPath, html, 'utf8');
  return reportPath;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
