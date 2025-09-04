import { createProgram, runProgram } from '../program';

const program = createProgram();

export async function run(argv: readonly string[]) {
    await runProgram(program, argv);
}
