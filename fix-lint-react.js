const fs = require('fs');
const p1 = 'src/components/settings/ProjectModelRouting.tsx';
let c1 = fs.readFileSync(p1, 'utf8');

c1 = c1.replace(
  `  useEffect(() => {
    loadData();
  }, [loadData]);`,
  `  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);`
);
fs.writeFileSync(p1, c1, 'utf8');
