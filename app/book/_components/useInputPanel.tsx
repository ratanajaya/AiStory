import { Textarea } from "@/components/Textarea";
import { useRef } from "react";
import { Panel } from "react-resizable-panels";

export default function useInputPanel(props:{
  inputTag: string;
}){
  // Use refs instead of state to avoid re-renders
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Function to get current values from refs
  const getUserInput = () => ({
    input1: inputRef.current?.value || '',
  });
  
  const element = (
    <Panel defaultSize={10} minSize={5} order={3}>
      <Textarea
        className=' h-full'
        placeholder={props.inputTag}
        ref={inputRef}
      />
    </Panel>
  );

  return { element, getUserInput };
}