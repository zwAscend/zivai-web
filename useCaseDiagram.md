```mermaid

%% Use Case Diagram (Mermaid)

graph TD
    %% Actors
    subgraph Actors
        Teacher[[Teacher]]
        Student[[Student]]
        GeminiAI((Gemini AI))
    end

    %% Use Cases (Goals/Functions)
    subgraph System Functions
        UC_Auth((Authenticate User))
        UC_ManageResource((Manage Resources (Upload/Fetch)))
        UC_ManageCourse((Create & Enroll in Courses))
        UC_ManageAssess((Create & Schedule Assessment))
        UC_TakeAssess((Take Assessment))
        UC_ViewReport((View Progress Report))
        UC_GradeAssess((Grade Assessment))
        UC_PlanPath((Plan Learner Path))
        UC_TrackSkill((Track & Evaluate Skills))
        UC_GetNotif((Receive Notifications & Chat))
        UC_ManageCal((Schedule Events))
    end

    %% Relationships (Actor -> Use Case)
    Teacher --> UC_Auth
    Teacher --> UC_ManageCourse
    Teacher --> UC_ManageAssess
    Teacher --> UC_GradeAssess
    Teacher --> UC_ManageResource
    Teacher --> UC_ManageCal

    Student --> UC_Auth
    Student --> UC_ManageCourse
    Student --> UC_TakeAssess
    Student --> UC_ViewReport
    Student --> UC_GetNotif
    Student --> UC_ManageResource

    %% Relationships (Use Case Includes/Extends/Informs)

    %% Authentication is often included in major actions
    UC_ManageCourse ..> UC_Auth : <<include>>
    UC_ManageAssess ..> UC_Auth : <<include>>

    %% Progress is based on Assessments
    UC_GradeAssess --> UC_ViewReport : <<informs>>
    UC_TakeAssess --> UC_GradeAssess : <<informs>>

    %% Development Planning relies on Assessment results and updates Skills
    UC_GradeAssess --> UC_PlanPath : <<informs>>
    UC_PlanPath --> UC_TrackSkill : <<updates>>
    UC_TrackSkill --> UC_ViewReport : <<informs>>

    %% Calendar Schedules Assessments
    UC_ManageCal --> UC_ManageAssess : <<schedules>>

    %% Gemini AI assists with assessments and planning
    GeminiAI --> UC_ManageAssess : <<assists>>
    GeminiAI --> UC_PlanPath : <<assists>>

```