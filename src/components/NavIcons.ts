import {HomeIcon,CalendarIcon,BookIcon,CheckSquareIcon,ChartIcon,FolderIcon,TargetIcon,FileIcon,MessageIcon} from "./Icons";
import {MicrophoneIcon,RepeatIcon} from "./LearningVisuals";
import type {NavIcon} from "@/lib/student-navigation";

/** The picture for each place on the student map, shared by the tab bar and the sidebar. */
export const navIcons:Record<NavIcon,typeof HomeIcon>={home:HomeIcon,calendar:CalendarIcon,work:CheckSquareIcon,feedback:ChartIcon,documents:FileIcon,test:TargetIcon,speaking:MicrophoneIcon,lessons:BookIcon,practice:RepeatIcon,files:FolderIcon,writing:MessageIcon};
