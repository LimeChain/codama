import { definedTypeNode, numberTypeNode, programNode, sizePrefixTypeNode, stringTypeNode, structFieldTypeNode, structTypeNode } from "@codama/nodes";
import { getFromRenderMap } from "@codama/renderers-core";
import { visit } from "@codama/visitors-core";
import { test } from 'vitest';

import { getRenderMapVisitor } from "../src";
import { codeContains } from "./_setup";


test('it renders a prefix string on a defined type', () => {
        const node = programNode({
        definedTypes: [
                definedTypeNode({
                name: 'blob',
                type: structTypeNode([
                        structFieldTypeNode({
                        name: 'contentType',
                        type: sizePrefixTypeNode(stringTypeNode('utf8'), numberTypeNode('u8')),
                        }),
                ]),
                }),
        ],
        name: 'splToken',
        publicKey: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        });

        const renderMap = visit(node, getRenderMapVisitor());
        console.log('Render Map:', renderMap);

        codeContains(getFromRenderMap(renderMap, 'types/blob.dart'), [
                /class Blob\s*{/, // class declaration
                /final String content_type;/, // field declaration (matches your output)
                /import '\.\.\/shared\.dart';/, // shared import
                /Generated type definition for Blob/, // doc comment
                /void toBorsh\(BinaryWriter writer\)/, // serialization method
                /writer\.writeString\(content_type\)/, // serialization line
                /static Blob fromBorsh\(BinaryReader reader\)/, // deserialization method
                /content_type:\s*reader\.readString\(\)/, // deserialization line
        ]);
});