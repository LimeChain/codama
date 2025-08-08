import { AccountNode, ConstantDiscriminatorNode, InstructionNode, isNode, resolveNestedTypeNode } from "@codama/nodes";
import { createHash } from "node:crypto";

export function extractDiscriminatorBytes(node: AccountNode | InstructionNode): number[] {
    const constant = extractConstantDiscriminatorBytes(node.discriminators);
    if (constant.length) return constant;

    if (node.kind === 'instructionNode') {
        const fd = (node.discriminators ?? []).find(d => d.kind === 'fieldDiscriminatorNode');
        if (fd) {
            const arg = node.arguments.find(a => a.name === fd.name);
            if (arg && arg.defaultValue && isNode(arg.defaultValue, 'bytesValueNode') && typeof arg.defaultValue.data === 'string') {
                const buf = Buffer.from(arg.defaultValue.data, 'hex');
                return Array.from(buf);
            }
        }
        return computeAnchorDiscriminator('global', node.name);
    }

    if (node.kind === 'accountNode') {
        const fields = resolveNestedTypeNode(node.data).fields;
        const discField = fields.find(f => f.name === 'discriminator');
        if (
            discField &&
            isNode(discField.defaultValue, 'bytesValueNode') &&
            typeof discField.defaultValue.data === 'string'
        ) {
            const buf = Buffer.from(discField.defaultValue.data, 'hex');
            return Array.from(buf);
        }
        return computeAnchorDiscriminator('account', node.name);
    }

    return [];
}

function extractConstantDiscriminatorBytes(discriminators?: ConstantDiscriminatorNode[] | any[]): number[] {
    const d = (discriminators ?? []).find(
        (x: any): x is ConstantDiscriminatorNode => x?.kind === 'constantDiscriminatorNode',
    );
    if (!d) return [];

    const val = d.constant?.value;

    if (isNode(val, 'arrayValueNode')) {
        const items = val.items;
        if (Array.isArray(items) && items.every(el => isNode(el, 'numberValueNode'))) {
            return items.map(el => el.number);
        }
    }

    if (isNode(val, 'bytesValueNode') && typeof val.data === 'string' && val.encoding === 'base16') {
        const buf = Buffer.from(val.data, 'hex');
        return Array.from(buf);
    }

    return [];
}

function computeAnchorDiscriminator(prefix: 'global' | 'account', name: string): number[] {
    const preimage = `${prefix}:${name}`;
    const hash = createHash('sha256').update(Buffer.from(preimage, 'utf8')).digest();
    return Array.from(hash.subarray(0, 8));
}