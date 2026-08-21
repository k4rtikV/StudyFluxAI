import {
  archiveAnnouncement,
  createAnnouncement,
  deleteDraftAnnouncement,
  listAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
} from "../services/announcement.service.js";

export const getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await listAnnouncements();
    return res.status(200).json({ success: true, data: { announcements } });
  } catch (error) {
    next(error);
  }
};

export const createAnnouncementHandler = async (req, res, next) => {
  try {
    const announcement = await createAnnouncement({ adminId: req.user._id, payload: req.body || {} });
    return res.status(201).json({ success: true, data: { announcement } });
  } catch (error) {
    next(error);
  }
};

export const updateAnnouncementHandler = async (req, res, next) => {
  try {
    const announcement = await updateAnnouncement({ announcementId: req.params.announcementId, payload: req.body || {} });
    return res.status(200).json({ success: true, data: { announcement } });
  } catch (error) {
    next(error);
  }
};

export const publishAnnouncementHandler = async (req, res, next) => {
  try {
    const announcement = await publishAnnouncement(req.params.announcementId);
    return res.status(200).json({ success: true, data: { announcement } });
  } catch (error) {
    next(error);
  }
};

export const archiveAnnouncementHandler = async (req, res, next) => {
  try {
    const announcement = await archiveAnnouncement(req.params.announcementId);
    return res.status(200).json({ success: true, data: { announcement } });
  } catch (error) {
    next(error);
  }
};

export const deleteAnnouncementHandler = async (req, res, next) => {
  try {
    const data = await deleteDraftAnnouncement(req.params.announcementId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
