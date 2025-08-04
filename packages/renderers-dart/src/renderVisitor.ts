import { logError, logWarn } from '@codama/errors';
import { deleteDirectory, writeRenderMapVisitor } from '@codama/renderers-core';
import { rootNodeVisitor, visit } from '@codama/visitors-core';
import { spawnSync } from 'child_process';

import { GetRenderMapOptions, getRenderMapVisitor } from './getRenderMapVisitor';

export type RenderOptions = GetRenderMapOptions & {
    deleteFolderBeforeRendering?: boolean;
    formatCode?: boolean;
};

export function renderVisitor(path: string, options: RenderOptions = {}) {
    return rootNodeVisitor(root => {
        if (options.deleteFolderBeforeRendering ?? true) {
            deleteDirectory(path);
        }

        visit(root, writeRenderMapVisitor(getRenderMapVisitor(options), path));

        if (options.formatCode ?? true) {
            runFormatter('dart', ['format', path]);
        }
    });
}

function runFormatter(cmd: string, args: string[]) {
    const { stdout, stderr, error } = spawnSync(cmd, args);
    if (error?.message?.includes('ENOENT')) {
        logWarn(`Could not find ${cmd}, skipping formatting.`);
        return;
    }
    if (stdout.length > 0) {
        logWarn(`(dart-format) ${stdout ? stdout?.toString() : error}`);
    }
    if (stderr.length > 0) {
        logError(`(dart-format) ${stderr ? stderr.toString() : error}`);
    }
}