import React, { useState, useEffect } from "react";
import { Customer, Appointment } from "@/entities/all";
import { Users, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

import MetricCard from "../components/dashboard/MetricCard";
import RecentActivity from "../components/dashboard/RecentActivity";

export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [customerData, appointmentData] = await Promise.all([
        Customer.list(),
        Appointment.list('-created_date')
      ]);
      setCustomers(customerData);
      setAppointments(appointmentData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const calculateMetrics = () => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    
    const thisMonthAppointments = appointments.filter(apt => 
      new Date(apt.date) >= thisMonth && apt.status === 'completed'
    );
    
    const monthlyRevenue = thisMonthAppointments.reduce((sum, apt) => sum + (apt.price || 0), 0);
    const activeCustomers = customers.filter(c => c.status === 'active').length;
    const vipCustomers = customers.filter(c => c.status === 'vip').length;

    return {
      totalCustomers: customers.length,
      activeCustomers,
      vipCustomers,
      monthlyRevenue,
      completedAppointments: thisMonthAppointments.length
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Welcome to Bella Studio
          </h1>
          <p className="text-gray-600 text-lg">Your beauty business at a glance</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Customers"
            value={metrics.totalCustomers}
            icon={Users}
            gradient="from-rose-400 to-pink-500"
            change={metrics.activeCustomers > 0 ? `${metrics.activeCustomers} active` : ""}
            delay={0.1}
          />
          <MetricCard
            title="This Month Revenue"
            value={`$${metrics.monthlyRevenue.toFixed(2)}`}
            icon={DollarSign}
            gradient="from-emerald-400 to-teal-500"
            change={metrics.completedAppointments > 0 ? `${metrics.completedAppointments} appointments` : ""}
            delay={0.2}
          />
          <MetricCard
            title="VIP Customers"
            value={metrics.vipCustomers}
            icon={TrendingUp}
            gradient="from-purple-400 to-indigo-500"
            delay={0.3}
          />
          <MetricCard
            title="Total Appointments"
            value={appointments.length}
            icon={Calendar}
            gradient="from-amber-400 to-orange-500"
            delay={0.4}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <RecentActivity appointments={appointments} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="glass-effect rounded-2xl p-6 border-0 shadow-lg"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl border border-rose-100">
                <p className="font-medium text-gray-900">Today's Schedule</p>
                <p className="text-sm text-gray-600 mt-1">
                  {appointments.filter(apt => 
                    new Date(apt.date).toDateString() === new Date().toDateString()
                  ).length} appointments scheduled
                </p>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                <p className="font-medium text-gray-900">Customer Insights</p>
                <p className="text-sm text-gray-600 mt-1">
                  Most popular service: Facial treatments
                </p>
              </div>
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                <p className="font-medium text-gray-900">Business Growth</p>
                <p className="text-sm text-gray-600 mt-1">
                  {((metrics.activeCustomers / Math.max(metrics.totalCustomers, 1)) * 100).toFixed(0)}% customer retention rate
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}