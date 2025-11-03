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
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }
        
        .chart-container {
            background: white;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.08);
            border: 1px solid #e5e7eb;
            position: relative;
        }
        
        .chart-title {
            font-size: 1.3rem;
            font-weight: 700;
            margin-bottom: 20px;
            text-align: center;
            color: #1f2937;
            padding-bottom: 12px;
            border-bottom: 2px solid #f3f4f6;
        }
        
        .chart-wrapper {
            position: relative;
            height: 280px;
            width: 100%;
            margin: 0 auto;
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
            display: flex;
            align-items: center;
            transition: all 0.2s ease;
        }
        
        .file-item:hover {
            background: #f8fafc;
            transform: translateY(-1px);
        }
        
        .file-item.file-critical {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
        }
        
        .file-item.file-warning {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
        }
        
        .file-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .file-rank {
            font-weight: bold;
            color: #6b7280;
            margin-right: 12px;
            min-width: 30px;
            text-align: center;
            font-size: 0.9rem;
        }
        
        /* Build Analysis Styles */
        .build-overview {
            margin: 24px 0;
        }
        
        .build-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }
        
        .build-stat-card {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            border: 1px solid #e2e8f0;
            transition: all 0.3s ease;
        }
        
        .build-stat-card.primary {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            border-color: #1d4ed8;
        }
        
        .build-stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        }
        
        .stat-icon {
            font-size: 2.5rem;
            opacity: 0.8;
        }
        
        .stat-content {
            flex: 1;
        }
        
        .stat-label {
            font-size: 0.875rem;
            font-weight: 500;
            opacity: 0.8;
            margin-bottom: 4px;
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            line-height: 1.2;
        }
        
        /* Analysis Sections */
        .analysis-section {
            margin: 32px 0;
        }
        
        .section-title {
            font-size: 1.4rem;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 20px;
            padding: 12px 20px;
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            border-radius: 12px;
            border-left: 4px solid #3b82f6;
        }
        
        /* Files Grid */
        .files-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 16px;
        }
        
        .file-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .file-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        
        .file-card.critical {
            border-left: 4px solid #ef4444;
            background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
        }
        
        .file-card.warning {
            border-left: 4px solid #f59e0b;
            background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);
        }
        
        .file-card.normal {
            border-left: 4px solid #10b981;
        }
        
        .file-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .file-rank {
            background: #f3f4f6;
            color: #374151;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.875rem;
        }
        
        .file-type {
            background: #3b82f6;
            color: white;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .file-name {
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 4px;
            font-size: 1.1rem;
        }
        
        .file-path {
            color: #6b7280;
            font-size: 0.875rem;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            margin-bottom: 12px;
            word-break: break-all;
        }
        
        .file-metrics {
            margin-top: 12px;
        }
        
        .file-size {
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
        }
        
        .size-bar {
            background: #f3f4f6;
            height: 6px;
            border-radius: 3px;
            overflow: hidden;
        }
        
        .size-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.5s ease;
        }
        
        .size-fill.critical {
            background: linear-gradient(90deg, #ef4444, #dc2626);
        }
        
        .size-fill.warning {
            background: linear-gradient(90deg, #f59e0b, #d97706);
        }
        
        .size-fill.normal {
            background: linear-gradient(90deg, #10b981, #059669);
        }
        
        /* Dependencies Grid */
        .dependencies-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
        }
        
        .dependency-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            transition: all 0.3s ease;
            position: relative;
        }
        
        .dependency-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        
        .dependency-card.critical {
            border-left: 4px solid #ef4444;
            background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
        }
        
        .dependency-card.warning {
            border-left: 4px solid #f59e0b;
            background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);
        }
        
        .dependency-card.normal {
            border-left: 4px solid #10b981;
            background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
        }
        
        .dep-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .dep-rank {
            background: #f3f4f6;
            color: #374151;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.875rem;
        }
        
        .dep-icon {
            font-size: 1.5rem;
        }
        
        .dep-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .dep-name {
            font-weight: 700;
            color: #1f2937;
            font-size: 1.1rem;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            flex: 1;
            margin-right: 12px;
        }
        
        .dep-size-main {
            font-weight: 700;
            font-size: 1.2rem;
            color: #3b82f6;
            background: #eff6ff;
            padding: 6px 12px;
            border-radius: 8px;
            border: 2px solid #bfdbfe;
        }
        
        .dep-details {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .dep-files-info {
            display: flex;
            align-items: center;
        }
        
        .dep-files-count {
            color: #6b7280;
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .dep-impact-badge {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 2px solid transparent;
            transition: all 0.2s ease;
        }
        
        .dep-impact-badge.critical {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            color: #991b1b;
            border-color: #fecaca;
        }
        
        .dep-impact-badge.warning {
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
            color: #92400e;
            border-color: #fed7aa;
        }
        
        .dep-impact-badge.normal {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            color: #166534;
            border-color: #bbf7d0;
        }
        
        /* Code Issues Grid */
        .code-issues-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .code-issue-card {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 12px;
            padding: 20px;
            border: 2px solid #e2e8f0;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .code-issue-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            border-color: #3b82f6;
        }
        
        .code-issue-card.imports {
            border-left: 4px solid #f59e0b;
        }
        
        .code-issue-card.unused-files.critical {
            border-left: 4px solid #ef4444;
        }
        
        .code-issue-card.unused-files.warning {
            border-left: 4px solid #f59e0b;
        }
        
        .code-issue-card.unused-files.normal {
            border-left: 4px solid #6b7280;
        }
        
        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .issue-rank {
            background: #f3f4f6;
            color: #374151;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.875rem;
        }
        
        .issue-icon {
            font-size: 1.2rem;
        }
        
        .open-file-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.875rem;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .open-file-btn:hover {
            background: #2563eb;
            transform: scale(1.05);
        }
        
        .issue-content {
            margin-bottom: 15px;
        }
        
        .file-path-clean {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.95rem;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
            word-break: break-all;
        }
        
        .imports-count {
            color: #f59e0b;
            font-size: 0.875rem;
            font-weight: 600;
        }
        
        .file-stats {
            display: flex;
            gap: 15px;
        }
        
        .file-size {
            color: #3b82f6;
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .file-lines {
            color: #6b7280;
            font-size: 0.875rem;
        }
        
        .imports-preview {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .import-tag {
            background: #fef3c7;
            color: #92400e;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }
        
        .import-tag-more {
            background: #f3f4f6;
            color: #6b7280;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-style: italic;
        }
        
        .file-impact {
            margin-top: 12px;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 500;
            text-align: center;
        }
        
        .file-impact.critical {
            background: #fef2f2;
            color: #991b1b;
        }
        
        .file-impact.warning {
            background: #fffbeb;
            color: #92400e;
        }
        
        .file-impact.normal {
            background: #f0fdf4;
            color: #166534;
        }
        
        .pagination-info {
            text-align: center;
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
            color: #6b7280;
            font-size: 0.9rem;
            margin-top: 20px;
        }
        
        .pagination-info.critical {
            background: #fef2f2;
            color: #991b1b;
        }
        
        .delete-flag {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
        }
        
        .delete-flag.critical {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            color: #991b1b;
            border: 1px solid #fecaca;
        }
        
        .delete-flag.warning {
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
            color: #92400e;
            border: 1px solid #fed7aa;
        }
        
        .delete-flag.normal {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            color: #166534;
            border: 1px solid #bbf7d0;
        }
        
        .file-actions {
            margin-top: 15px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
        }
        
        .file-savings {
            color: #10b981;
            font-weight: 600;
            font-size: 0.875rem;
            margin-bottom: 8px;
        }
        
        .file-recommendation {
            font-size: 0.8rem;
            padding: 6px 10px;
            border-radius: 6px;
        }
        
        .file-recommendation.critical {
            background: #fef2f2;
            color: #991b1b;
        }
        
        .file-recommendation.warning {
            background: #fffbeb;
            color: #92400e;
        }
        
        .file-recommendation.normal {
            background: #f0fdf4;
            color: #166534;
        }
        
        .dep-impact {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 600;
            text-align: center;
        }
        
        .dep-impact.critical {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }
        
        .dep-impact.warning {
            background: #fffbeb;
            color: #d97706;
            border: 1px solid #fed7aa;
        }
        
        .dep-impact.normal {
            background: #f0fdf4;
            color: #059669;
            border: 1px solid #bbf7d0;
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
                padding: 16px;
            }
            
            .chart-wrapper {
                height: 240px;
            }
            
            .build-stats {
                grid-template-columns: 1fr;
                gap: 16px;
            }
            
            .build-stat-card {
                padding: 16px;
            }
            
            .files-grid {
                grid-template-columns: 1fr;
                gap: 12px;
            }
            
            .dependencies-grid {
                grid-template-columns: 1fr;
                gap: 12px;
            }
            
            .code-issues-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            
            .code-issue-card {
                padding: 15px;
            }
            
            .issue-header {
                flex-direction: column;
                gap: 10px;
                align-items: stretch;
            }
            
            .open-file-btn {
                width: 100%;
                justify-content: center;
            }
            
            .file-stats {
                flex-direction: column;
                gap: 8px;
            }
            
            .imports-preview {
                gap: 4px;
            }
            
            .import-tag {
                font-size: 0.7rem;
                padding: 3px 6px;
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
        
        /* Package Analysis Styles */
        .package-subsection {
            margin: 24px 0;
        }
        
        .package-subsection h3 {
            color: #1f2937;
            margin-bottom: 20px;
            font-size: 1.25rem;
            font-weight: 600;
        }
        
        .package-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
        }
        
        .package-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            transition: all 0.3s ease;
            position: relative;
        }
        
        .package-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        
        .package-card.unused-package.critical {
            border-left: 4px solid #ef4444;
            background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
        }
        
        .package-card.unused-package.warning {
            border-left: 4px solid #f59e0b;
            background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);
        }
        
        .package-card.unused-package.normal {
            border-left: 4px solid #10b981;
            background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
        }
        
        .package-card.deprecated-package {
            border-left: 4px solid #f59e0b;
            background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);
        }
        
        .package-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .package-rank {
            background: #f3f4f6;
            color: #374151;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.875rem;
        }
        
        .package-icon {
            font-size: 1.5rem;
        }
        
        .package-type-badge {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .package-type-badge.prod {
            background: #ef4444;
            color: white;
        }
        
        .package-type-badge.dev {
            background: #3b82f6;
            color: white;
        }
        
        .package-content {
            margin-bottom: 16px;
        }
        
        .package-name {
            font-weight: 700;
            font-size: 1.1rem;
            color: #1f2937;
            margin-bottom: 4px;
        }
        
        .package-version {
            color: #6b7280;
            font-size: 0.875rem;
            margin-bottom: 8px;
        }
        
        .package-size {
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .package-size.critical {
            color: #dc2626;
        }
        
        .package-size.warning {
            color: #d97706;
        }
        
        .package-size.normal {
            color: #059669;
        }
        
        .package-actions {
            border-top: 1px solid #f3f4f6;
            padding-top: 12px;
            font-size: 0.875rem;
        }
        
        .removal-command {
            background: #f8fafc;
            color: #374151;
            padding: 6px 10px;
            border-radius: 6px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            margin-bottom: 8px;
            font-size: 0.8rem;
        }
        
        .size-savings {
            color: #059669;
            font-weight: 600;
        }
        
        .deprecation-message {
            background: #fef3c7;
            color: #92400e;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.875rem;
            margin: 8px 0;
            font-style: italic;
        }
        
        .replacement-suggestion {
            background: #dbeafe;
            color: #1d4ed8;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.875rem;
            margin-top: 8px;
        }
        
        .total-savings {
            text-align: center;
            padding: 16px;
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-radius: 8px;
            color: #166534;
            font-size: 1.1rem;
            border: 1px solid #bbf7d0;
        }
        
        @media (max-width: 768px) {
            .package-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
                <div class="header">
            <h1>🚀 React Native Optimizer Report</h1>
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
                    <div class="chart-title">📊 Issues Distribution</div>
                    <div class="chart-wrapper">
                        <canvas id="issuesChart"></canvas>
                    </div>
                </div>
                <div class="chart-container">
                    <div class="chart-title">❤️ Project Health Score</div>
                    <div class="chart-wrapper">
                        <canvas id="healthChart"></canvas>
                    </div>
                </div>
                ${result.buildAnalysis ? `
                <div class="chart-container">
                    <div class="chart-title">📦 Bundle Breakdown</div>
                    <div class="chart-wrapper">
                        <canvas id="bundleChart"></canvas>
                    </div>
                </div>
                <div class="chart-container">
                    <div class="chart-title">📚 Dependencies Size</div>
                    <div class="chart-wrapper">
                        <canvas id="dependencyChart"></canvas>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${result.buildAnalysis ? `
        <!-- Build Analysis Section -->
        <div class="section">
            <h2>📦 Build Analysis</h2>
            <div class="build-overview">
                <div class="build-stats">
                    <div class="build-stat-card primary">
                        <div class="stat-icon">📦</div>
                        <div class="stat-content">
                            <div class="stat-label">Bundle Size</div>
                            <div class="stat-value">${formatBytes(result.buildAnalysis.totalSize)}</div>
                        </div>
                    </div>
                    <div class="build-stat-card">
                        <div class="stat-icon">📂</div>
                        <div class="stat-content">
                            <div class="stat-label">Build Path</div>
                            <div class="stat-value">${result.buildAnalysis.buildPath}</div>
                        </div>
                    </div>
                    <div class="build-stat-card">
                        <div class="stat-icon">📄</div>
                        <div class="stat-content">
                            <div class="stat-label">Total Files</div>
                            <div class="stat-value">${result.buildAnalysis.files.length}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${result.buildAnalysis.largestFiles.length > 0 ? `
            <div class="analysis-section">
                <h3 class="section-title">🗂️ Largest Files (Top 15)</h3>
                <div class="files-grid">
                    ${result.buildAnalysis.largestFiles.map((file, index) => {
                        const sizeClass = file.size > 1024 * 1024 ? 'critical' : file.size > 500 * 1024 ? 'warning' : 'normal';
                        const sizePercent = Math.min(100, (file.size / (result.buildAnalysis?.totalSize || 1)) * 100);
                        return `
                        <div class="file-card ${sizeClass}">
                            <div class="file-header">
                                <div class="file-rank">#${index + 1}</div>
                                <div class="file-type">${file.type || 'js'}</div>
                            </div>
                            <div class="file-info">
                                <div class="file-name">${file.path.split('/').pop()}</div>
                                <div class="file-path">${file.path}</div>
                                <div class="file-metrics">
                                    <div class="file-size">${formatBytes(file.size)}</div>
                                    <div class="size-bar">
                                        <div class="size-fill ${sizeClass}" style="width: ${sizePercent}%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
            
            ${result.buildAnalysis.dependencies.length > 0 ? `
            <div class="analysis-section">
                <h3 class="section-title">📚 Large Dependencies</h3>
                <div class="dependencies-grid">
                    ${result.buildAnalysis.dependencies.slice(0, 15).map((dep, index) => {
                        const sizeClass = dep.size > 5 * 1024 * 1024 ? 'critical' : dep.size > 1024 * 1024 ? 'warning' : 'normal';
                        const sizeMB = (dep.size / (1024 * 1024)).toFixed(1);
                        return `
                        <div class="dependency-card ${sizeClass}">
                            <div class="dep-header">
                                <div class="dep-rank">#${index + 1}</div>
                                <div class="dep-icon">📦</div>
                            </div>
                            <div class="dep-main">
                                <div class="dep-name">${dep.name}</div>
                                <div class="dep-size-main">${formatBytes(dep.size)}</div>
                            </div>
                            <div class="dep-details">
                                <div class="dep-files-info">
                                    <span class="dep-files-count">${dep.files} files</span>
                                </div>
                                <div class="dep-impact-badge ${sizeClass}">
                                    ${sizeClass === 'critical' ? '🚨 High' : 
                                      sizeClass === 'warning' ? '⚠️ Medium' : '✅ Low'}
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Unused Imports Section -->
        <div class="section">
            <h2>⚠️ Unused Imports (${result.unusedImports.length} files)</h2>
            ${result.unusedImports.length > 0 ? `
                <div class="code-issues-grid">
                    ${result.unusedImports.slice(0, 50).map((item, index) => `
                        <div class="code-issue-card imports" onclick="openFileInEditor('${item.file}')" title="Click to open in editor">
                            <div class="issue-header">
                                <div class="issue-rank">#${index + 1}</div>
                                <div class="issue-icon">📄</div>
                                <button class="open-file-btn" onclick="event.stopPropagation(); openFileInEditor('${item.file.replace(/'/g, "\\'")}')">
                                    <span>📝</span> Open
                                </button>
                            </div>
                            <div class="issue-content">
                                <div class="file-path-clean">${item.file}</div>
                                <div class="imports-count">${item.imports.length} unused imports</div>
                            </div>
                            <div class="imports-preview">
                                ${item.imports.slice(0, 6).map(imp => `<span class="import-tag">${imp}</span>`).join('')}
                                ${item.imports.length > 6 ? `<span class="import-tag-more">+${item.imports.length - 6} more</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${result.unusedImports.length > 50 ? `
                    <div class="pagination-info">
                        <span>Showing first 50 files</span> • 
                        <span><strong>${result.unusedImports.length}</strong> total files with unused imports</span>
                    </div>
                ` : ''}
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
                <div class="code-issues-grid">
                    ${result.unusedFiles.slice(0, 100).map((file, index) => {
                        const sizeClass = file.size > 10000 ? 'critical' : file.size > 1000 ? 'warning' : 'normal';
                        return `
                        <div class="code-issue-card unused-files ${sizeClass}">
                            <div class="issue-header">
                                <div class="issue-rank">#${index + 1}</div>
                                <div class="issue-icon">🗑️</div>
                                <div class="delete-flag ${sizeClass}">
                                    ${sizeClass === 'critical' ? '🚨 Review First' : 
                                      sizeClass === 'warning' ? '⚠️ Can Delete' : '✅ Safe to Delete'}
                                </div>
                            </div>
                            <div class="issue-content">
                                <div class="file-path-clean">${file.path}</div>
                                <div class="file-stats">
                                    <div class="file-size">${formatBytes(file.size)}</div>
                                    <div class="file-lines">${file.lines} lines</div>
                                </div>
                            </div>
                            <div class="file-actions">
                                <div class="file-savings">💾 Save ${formatBytes(file.size)} disk space</div>
                                <div class="file-recommendation ${sizeClass}">
                                    ${sizeClass === 'critical' ? 'Large file - review before deleting' : 
                                      sizeClass === 'warning' ? 'Medium file - likely safe to remove' : 'Small file - safe to delete'}
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                ${result.unusedFiles.length > 100 ? `
                    <div class="pagination-info critical">
                        <span>Showing first 100 files</span> • 
                        <span><strong>${result.unusedFiles.length}</strong> total unused files</span>
                    </div>
                ` : ''}
            ` : `
                <div class="empty-state">
                    <div class="icon success">✅</div>
                    <p>Great! No unused files detected in your project.</p>
                </div>
            `}
        </div>
        
        <!-- Package Analysis Section -->
        ${result.packageAnalysis ? `
            <div class="section">
                <h2>📦 Package Analysis</h2>
                
                <!-- Unused Packages -->
                <div class="package-subsection">
                    <h3>🗑️ Unused Packages (${result.packageAnalysis.unusedPackages.length} packages)</h3>
                    ${result.packageAnalysis.unusedPackages.length > 0 ? `
                        <div class="package-grid">
                            ${result.packageAnalysis.unusedPackages.map((pkg, index) => {
                                const sizeClass = pkg.size > 1024 * 1024 ? 'critical' : pkg.size > 100 * 1024 ? 'warning' : 'normal';
                                return `
                                <div class="package-card unused-package ${sizeClass}">
                                    <div class="package-header">
                                        <div class="package-rank">#${index + 1}</div>
                                        <div class="package-icon">📦</div>
                                        <div class="package-type-badge ${pkg.type === 'dependencies' ? 'prod' : 'dev'}">${pkg.type === 'dependencies' ? 'PROD' : 'DEV'}</div>
                                    </div>
                                    <div class="package-content">
                                        <div class="package-name">${pkg.name}</div>
                                        <div class="package-version">v${pkg.version}</div>
                                        <div class="package-size ${sizeClass}">${pkg.estimatedSize || formatBytes(pkg.size)}</div>
                                    </div>
                                    <div class="package-actions">
                                        <div class="removal-command">npm uninstall ${pkg.name}</div>
                                        <div class="size-savings">💾 Save ${pkg.estimatedSize || formatBytes(pkg.size)}</div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="total-savings">
                            <strong>Total potential savings: ${formatBytes(result.packageAnalysis.totalUnusedSize)}</strong>
                        </div>
                    ` : `
                        <div class="empty-state">
                            <div class="icon success">✅</div>
                            <p>Excellent! All packages are being used in your project.</p>
                        </div>
                    `}
                </div>
                
                <!-- Deprecated Packages -->
                <div class="package-subsection">
                    <h3>⚠️ Deprecated Packages (${result.packageAnalysis.deprecatedPackages.length} packages)</h3>
                    ${result.packageAnalysis.deprecatedPackages.length > 0 ? `
                        <div class="package-grid">
                            ${result.packageAnalysis.deprecatedPackages.map((pkg, index) => `
                                <div class="package-card deprecated-package">
                                    <div class="package-header">
                                        <div class="package-rank">#${index + 1}</div>
                                        <div class="package-icon">⚠️</div>
                                        <div class="package-type-badge ${pkg.type === 'dependencies' ? 'prod' : 'dev'}">${pkg.type === 'dependencies' ? 'PROD' : 'DEV'}</div>
                                    </div>
                                    <div class="package-content">
                                        <div class="package-name">${pkg.name}</div>
                                        <div class="package-version">v${pkg.version}</div>
                                        ${pkg.deprecatedMessage ? `<div class="deprecation-message">${pkg.deprecatedMessage}</div>` : ''}
                                        ${pkg.suggestedReplacement ? `
                                            <div class="replacement-suggestion">
                                                💡 Consider: <strong>${pkg.suggestedReplacement}</strong>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="empty-state">
                            <div class="icon success">✅</div>
                            <p>Great! No deprecated packages found in your project.</p>
                        </div>
                    `}
                </div>
            </div>
        ` : ''}
        
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
        // Wait for DOM and Chart.js to be ready
        document.addEventListener('DOMContentLoaded', function() {
            // Check if Chart.js is loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js not loaded');
                return;
            }

        // Format bytes helper
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
        

        
        // Open file in editor
        function openFileInEditor(filePath) {
            console.log('Attempting to open file:', filePath);
            
            // Get project root path 
            const projectRoot = window.location.href.replace('/optimizer-report.html', '').replace('file://', '');
            const fullPath = projectRoot + '/' + filePath;
            
            console.log('Full path:', fullPath);
            
            // Try VSCode first (most common)
            const vscodeUrl = 'vscode://file' + fullPath;
            console.log('Trying VSCode URL:', vscodeUrl);
            
            try {
                // Create invisible link and try to open
                const link = document.createElement('a');
                link.href = vscodeUrl;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showNotification('Opening in VSCode... If it doesn\\'t work, the file path is copied to clipboard.');
                
                // Also copy to clipboard as backup
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(filePath).catch(() => {
                        // Ignore clipboard errors
                    });
                }
                
                return;
            } catch (e) {
                console.warn('VSCode open failed:', e);
            }
            
            // Fallback methods
            const alternativeUrls = [
                'code://file' + fullPath,
                'atom://open/?url=file://' + fullPath,
                'subl://open?url=file://' + fullPath,
                'webstorm://open?file=' + fullPath
            ];
            
            let attempted = false;
            for (const url of alternativeUrls) {
                try {
                    window.open(url, '_blank');
                    attempted = true;
                    break;
                } catch (e) {
                    console.warn('Failed to open with:', url, e);
                }
            }
            
            // Always copy to clipboard
            if (navigator.clipboard) {
                navigator.clipboard.writeText(filePath).then(() => {
                    showNotification('File path copied to clipboard: ' + filePath);
                }).catch(() => {
                    showNotification('File: ' + filePath);
                });
            } else {
                // Fallback for older browsers
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = filePath;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    showNotification('File path copied to clipboard: ' + filePath);
                } catch (e) {
                    showNotification('File: ' + filePath);
                }
            }
        }
        
        // Show notification
        function showNotification(message) {
            console.log('Showing notification:', message);
            
            const notification = document.createElement('div');
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.background = '#10b981';
            notification.style.color = 'white';
            notification.style.padding = '12px 20px';
            notification.style.borderRadius = '8px';
            notification.style.fontWeight = '500';
            notification.style.zIndex = '10000';
            notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            notification.style.transition = 'all 0.3s ease';
            notification.style.maxWidth = '300px';
            notification.style.fontSize = '14px';
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);
        }            // Chart data
            const cleanFiles = ${result.projectStats.totalFiles - result.unusedImports.length - result.unusedFiles.length};
            const unusedImportFiles = ${result.unusedImports.length};
            const unusedFiles = ${result.unusedFiles.length};
            const totalFiles = ${result.projectStats.totalFiles};

            console.log('Chart Data:', { cleanFiles, unusedImportFiles, unusedFiles, totalFiles });

            // Issues Distribution Chart
            const issuesCanvas = document.getElementById('issuesChart');
            if (!issuesCanvas) {
                console.error('Issues chart canvas not found');
                return;
            }
            const issuesCtx = issuesCanvas.getContext('2d');
        new Chart(issuesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Clean Files', 'Files with Unused Imports', 'Completely Unused Files'],
                datasets: [{
                    data: [cleanFiles, unusedImportFiles, unusedFiles],
                    backgroundColor: [
                        '#10b981',  // Green for clean files
                        '#f59e0b',  // Amber for unused imports
                        '#ef4444'   // Red for unused files
                    ],
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverBackgroundColor: [
                        '#059669',  // Darker green
                        '#d97706',  // Darker amber  
                        '#dc2626'   // Darker red
                    ],
                    hoverBorderWidth: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '50%',
                layout: {
                    padding: 10
                },
                animation: {
                    duration: 1000,
                    animateRotate: true,
                    easing: 'easeInOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { 
                                size: 12,
                                weight: '500'
                            },
                            color: '#374151'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const value = context.raw || 0;
                                const percentage = ((value / totalFiles) * 100).toFixed(1);
                                return ' ' + value + ' files (' + percentage + '% of project)';
                            },
                            afterLabel: function(context) {
                                if (context.dataIndex === 1 && unusedImportFiles > 0) {
                                    return 'Impact: Code cleanup needed';
                                } else if (context.dataIndex === 2 && unusedFiles > 0) {
                                    return 'Impact: Dead code removal';
                                } else if (context.dataIndex === 0) {
                                    return 'Status: Well maintained';
                                }
                                return '';
                            }
                        }
                    }
                }
            }
        });
        
            // Health Score Calculation
            let healthScore = 100;
            
            // Penalize unused imports (lighter penalty)
            healthScore -= (unusedImportFiles / totalFiles) * 30;
            
            // Penalize unused files (heavier penalty)  
            healthScore -= (unusedFiles / totalFiles) * 50;
            
            // Add build analysis penalty if available
            ${result.buildAnalysis ? `
            const bundleSizeMB = ${result.buildAnalysis.totalSize} / (1024 * 1024);
            if (bundleSizeMB > 10) healthScore -= 15;
            else if (bundleSizeMB > 5) healthScore -= 8;
            ` : ''}
            
            // Ensure score is between 0-100
            healthScore = Math.max(0, Math.min(100, healthScore));
            
            console.log('Health Score:', healthScore);

            // Health Chart
            const healthCanvas = document.getElementById('healthChart');
            if (!healthCanvas) {
                console.error('Health chart canvas not found');
                return;
            }
            const healthCtx = healthCanvas.getContext('2d');
        new Chart(healthCtx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [healthScore, 100 - healthScore],
                    backgroundColor: [
                        healthScore >= 90 ? '#10b981' : 
                        healthScore >= 75 ? '#84cc16' :
                        healthScore >= 60 ? '#f59e0b' : 
                        healthScore >= 40 ? '#f97316' : '#ef4444',
                        '#f3f4f6'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                layout: {
                    padding: 10
                },
                animation: {
                    duration: 1200,
                    animateRotate: true,
                    easing: 'easeInOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        enabled: true,
                        callbacks: {
                            label: function() {
                                return 'Health Score: ' + Math.round(healthScore) + '%';
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw: function(chart) {
                    const ctx = chart.ctx;
                    const centerX = chart.width / 2;
                    const centerY = chart.height / 2;
                    
                    ctx.save();
                    
                    // Main score
                    ctx.font = 'bold 32px system-ui';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = healthScore >= 90 ? '#10b981' : 
                                   healthScore >= 75 ? '#84cc16' :
                                   healthScore >= 60 ? '#f59e0b' : 
                                   healthScore >= 40 ? '#f97316' : '#ef4444';
                    ctx.fillText(Math.round(healthScore) + '%', centerX, centerY - 5);
                    
                    // Label
                    ctx.font = 'bold 14px system-ui';
                    ctx.fillStyle = '#374151';
                    ctx.fillText('Health Score', centerX, centerY + 20);
                    
                    // Status text
                    ctx.font = '12px system-ui';
                    ctx.fillStyle = '#6b7280';
                    const status = healthScore >= 90 ? 'Excellent' :
                                  healthScore >= 75 ? 'Good' :
                                  healthScore >= 60 ? 'Fair' :
                                  healthScore >= 40 ? 'Poor' : 'Critical';
                    ctx.fillText(status, centerX, centerY + 35);
                    
                    ctx.restore();
                }
            }]
        });
        
            ${result.buildAnalysis ? `
            // Bundle Breakdown Chart
            const bundleCanvas = document.getElementById('bundleChart');
            if (bundleCanvas) {
                const bundleCtx = bundleCanvas.getContext('2d');
        new Chart(bundleCtx, {
            type: 'pie',
            data: {
                labels: ['JavaScript', 'Images', 'Fonts', 'Source Maps', 'Other'],
                datasets: [{
                    data: [
                        ${result.buildAnalysis.bundleBreakdown.javascript},
                        ${result.buildAnalysis.bundleBreakdown.images},
                        ${result.buildAnalysis.bundleBreakdown.fonts},
                        ${result.buildAnalysis.bundleBreakdown.maps},
                        ${result.buildAnalysis.bundleBreakdown.other}
                    ],
                    backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#6b7280', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 10
                },
                animation: { duration: 800 },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + formatBytes(context.raw);
                            }
                        }
                    }
                }
                }
            });
            }
            
            // Dependencies Chart
            const depCanvas = document.getElementById('dependencyChart');
            if (depCanvas) {
                const depCtx = depCanvas.getContext('2d');
        new Chart(depCtx, {
            type: 'bar',
            data: {
                labels: [${result.buildAnalysis.dependencies.slice(0, 5).map(dep => `'${dep.name}'`).join(', ')}],
                datasets: [{
                    label: 'Size (bytes)',
                    data: [${result.buildAnalysis.dependencies.slice(0, 5).map(dep => dep.size).join(', ')}],
                    backgroundColor: '#3b82f6',
                    borderColor: '#1d4ed8',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 10
                },
                animation: { duration: 800 },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatBytes(value);
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatBytes(context.raw);
                            }
                        }
                    }
                }
                }
            });
            }
            ` : ''}

        }); // End DOMContentLoaded event listener
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
