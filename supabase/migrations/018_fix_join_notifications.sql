-- Fix join request notifications to handle UPSERTS and better admin lookup

CREATE OR REPLACE FUNCTION public.notify_admin_on_join_request()
RETURNS TRIGGER AS $$
DECLARE
    admin_id UUID;
    group_name_var TEXT;
    requester_name TEXT;
BEGIN
    -- 1. Only notify if status is 'pending'
    IF NEW.status != 'pending' THEN
        RETURN NEW;
    END IF;

    -- 2. If it is an update, only notify if the status actually changed to pending 
    -- (e.g. from 'rejected' back to 'pending'). If it was already pending, don't spam.
    IF (TG_OP = 'UPDATE' AND OLD.status = 'pending') THEN
        RETURN NEW;
    END IF;

    -- 3. Get group name
    SELECT COALESCE(name, 'Grupo sem nome') INTO group_name_var FROM public.groups WHERE id = NEW.group_id;
    
    -- 4. Get requester name (robust check: display_name -> nick -> email prefix -> Default)
    SELECT COALESCE(display_name, nickname, SUBSTRING(email FROM '(.*)@'), 'Usuário') INTO requester_name 
    FROM public.profiles WHERE id = NEW.user_id;
    
    -- 5. Get group admin(s) and create notification for each
    FOR admin_id IN 
        SELECT user_id FROM public.group_members 
        WHERE group_id = NEW.group_id AND role = 'admin'
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
            admin_id,
            'notifications.system.join_request.title',
            'notifications.system.join_request.message',
            'join_request',
            jsonb_build_object(
                'pending_member_id', NEW.id,
                'group_id', NEW.group_id,
                'group', group_name_var,
                'requester_id', NEW.user_id,
                'name', requester_name,
                'link', '/groups/' || NEW.group_id::TEXT
            )
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to handle both INSERT and UPDATE (for upserts)
DROP TRIGGER IF EXISTS on_pending_member_created ON public.pending_members;
CREATE TRIGGER on_pending_member_created
    AFTER INSERT OR UPDATE ON public.pending_members
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_admin_on_join_request();
