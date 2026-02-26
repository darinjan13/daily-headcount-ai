import { useState } from "react";
import ExcelUploader from "./components/ExcelUploader";
import Dashboard from "./components/Dashboard";

function App() {
  const [data, setData] = useState(null);
  const [blueprint, setBlueprint] = useState(null);

  return (
    <div>
      <h1 style={{ textAlign: "center" }}>
        AI Dashboard Generator
      </h1>

      {!data && (
        <ExcelUploader
          onDataReady={(extracted, blueprint) => {
            setData(extracted);
            setBlueprint(blueprint);
          }}
        />
      )}

      {data && blueprint && (
        <Dashboard data={data} blueprint={blueprint} />
      )}
    </div>
  );
}

export default App;