const fs = require('fs');
let code = fs.readFileSync('src/components/WeeklyView.tsx', 'utf8');

const target = `<div className="min-w-[800px]">`;
const replacement = `
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={3}
          centerOnInit={false}
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: true }}
          panning={{ velocityDisabled: true }}
        >
          <TransformComponent wrapperClass="w-full" contentClass="w-full min-w-[800px]">
            <div className="w-full">
`;
code = code.replace(target, replacement);

const target2 = `          </div>\n        </div>\n      </div>\n    </div>\n  );\n}`;
const replacement2 = `          </div>\n            </div>\n          </TransformComponent>\n        </TransformWrapper>\n      </div>\n    </div>\n  );\n}`;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/WeeklyView.tsx', code);
