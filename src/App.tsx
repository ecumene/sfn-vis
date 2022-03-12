import { ToastContainer, toast } from "react-toastify";
import { Link, Route } from "wouter";
import { useEffect, useMemo, useState } from "react";
import ReactJson from "react-json-view";

import useFetch from "./useFetch";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

type Message = {
  Type: string;
  PreviousEventId: string;
};

type Log = {
  date: string;
  executionArn: string;
  message: Message;
};

type ExecutionProps = {
  status: string;
  started: string;
  ended: string;
  statusColor: string;
  executionArn: string;
  logs: Log[];
};

const Header = () => {
  return (
    <div className="border-grey-200 border-b-2 py-4 mb-4">
      <header className="container m-auto flex align-middle">
        <h1 className="text-3xl font-bold underline">🧐 Sfn Vis</h1>
        <Link
          to="/"
          className="border-2 border-sky-100 bg-sky-200 hover:bg-sky-400 py-1 px-2 rounded-md"
        >
          All Executions
        </Link>
      </header>
    </div>
  );
};

const columns = ["Date", "Type", "Name", "PreviousEventId"];

function ExecutionLog({ date, message }: Log) {
  const [showDetails, setShowDetails] = useState(false);

  let DetailsComponent = null;
  let eventDetailsValue: any | null = null;

  const eventDetails = Object.entries(message).find(([key]) =>
    key.includes("EventDetails")
  );

  if (eventDetails && eventDetails[1]) {
    eventDetailsValue = eventDetails[1] as unknown;
    DetailsComponent = () => <ReactJson src={eventDetailsValue} />;
  } else {
    DetailsComponent = () => <>No Data...</>;
  }

  return (
    <>
      <tr
        role="button"
        onClick={() => setShowDetails(!showDetails)}
        className="border border-b-0 bg-gray-100"
      >
        {[
          date,
          message.Type,
          eventDetailsValue?.Name,
          message.PreviousEventId,
        ].map((item) => (
          <td key={item} className="py-2">
            {item}
          </td>
        ))}
      </tr>
      {showDetails && (
        <tr className="border border-b-0">
          <td className="overflow-x-auto" colSpan={columns.length}>
            <DetailsComponent />
          </td>
        </tr>
      )}
    </>
  );
}

function Execution({
  status,
  executionArn,
  logs,
  statusColor,
}: ExecutionProps) {
  return (
    <div className="container m-auto flex flex-col">
      <div
        className={`border-dashed border-2 ${statusColor} p-5 my-5 flex flex-col`}
      >
        <table>
          <thead>
            <tr>
              {["Name", "Status", "Started At", "Ended At"].map((item) => (
                <td key={item} className="font-bold py-2">
                  {item}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{executionArn}</td>
              <td>{status}</td>
              <td>{logs[0].date}</td>
              <td>{logs[logs.length - 1].date}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="flex-1">
        <thead>
          <tr>
            {columns.map((name) => (
              <td key={name} className="font-bold py-2">
                {name}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <ExecutionLog key={log.date} {...log} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const { data, error, fetchData } = useFetch<Log[]>(
    "http://localhost:3117/logs"
  );

  useEffect(() => {
    if (error) {
      toast.error(error.message);
    }
  }, [error]);

  useEffect(() => {
    fetchData();

    const timeout = setTimeout(() => {
      fetchData();
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  const executionArns = useMemo(
    () => [...new Set(data?.map(({ executionArn }) => executionArn))],
    [data]
  );

  const executions = useMemo(() => {
    if (data) {
      // todo
      const out: Record<
        string,
        {
          statusColor: string;
          started: string;
          ended: string;
          status: string;
          logs: Log[];
        }
      > = {};

      for (const executionArn of executionArns) {
        let name = executionArn.split(":")[7];
        const logs = data.filter((log) => log.executionArn === executionArn);
        const successful = logs.some(
          (log) => log.message.Type === "ExecutionSucceeded"
        );
        const failed = logs.some(
          (log) => log.message.Type === "ExecutionFailed"
        );

        let started = logs[0].date;
        let ended = logs[logs.length - 1].date;

        const status = successful
          ? "SUCCESSFUL"
          : failed
          ? "FAILED"
          : "RUNNING";

        const statusColor =
          status === "SUCCESSFUL"
            ? "border-emerald-500 bg-emerald-200"
            : status === "FAILED"
            ? "border-red-500 bg-red-200"
            : "border-slate-500 bg-slate-200";
        out[name] = { statusColor, status, started, ended, logs };
      }

      return out;
    }
  }, [data, executionArns]);

  if (!executions) {
    return <div>Loading...</div>;
  }

  return (
    <div className="App">
      <Route path="/">
        <Header />
        <div className="container m-auto flex flex-col">
          <table>
            <thead>
              <tr>
                {["Name", "Status", "Started At", "Ended At"].map((item) => (
                  <td key={item} className="font-bold py-2">
                    {item}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(executions)
                .sort(([__, { started: a }], [_, { started: b }]) =>
                  a < b ? 1 : -1
                )
                .map(
                  ([executionArn, { status, statusColor, started, ended }]) => {
                    return (
                      <Link
                        key={executionArn}
                        href={`/execution/${executionArn}`}
                      >
                        <tr className="cursor-pointer" key={executionArn}>
                          <td>{executionArn}</td>
                          <td>
                            <div className={`p-1 rounded-md ${statusColor}`}>
                              {status}
                            </div>
                          </td>
                          <td>{started}</td>
                          <td>{ended}</td>
                        </tr>
                      </Link>
                    );
                  }
                )}
            </tbody>
          </table>
        </div>
      </Route>
      <Route path={`/execution/:executionArn`}>
        {(params) =>
          executions[params.executionArn] ? (
            <>
              <Header />
              <Execution
                executionArn={params.executionArn}
                {...executions[params.executionArn]}
              />
            </>
          ) : (
            <div>Loading...</div>
          )
        }
      </Route>
      <ToastContainer />
    </div>
  );
}

export default App;
