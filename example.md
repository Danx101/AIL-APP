import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, Calendar, Star } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function CustomerCard({ customer, onViewDetails, delay = 0 }) {
  const getStatusColor = (status) => {
    const colors = {
      active: "bg-green-100 text-green-700 border-green-200",
      inactive: "bg-gray-100 text-gray-700 border-gray-200",
      vip: "bg-purple-100 text-purple-700 border-purple-200"
    };
    return colors[status] || colors.active;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
    >
      <Card className="glass-effect border-0 shadow-lg hover:shadow-xl transition-all duration-500 group cursor-pointer"
            onClick={() => onViewDetails(customer)}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-rose-200 to-pink-200 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  {customer.first_name} {customer.last_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`${getStatusColor(customer.status)} border text-xs`}>
                    {customer.status === 'vip' && <Star className="w-3 h-3 mr-1" />}
                    {customer.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {customer.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.date_of_birth && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Born {format(new Date(customer.date_of_birth), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {customer.preferred_services && customer.preferred_services.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Preferred Services</p>
              <div className="flex flex-wrap gap-1">
                {customer.preferred_services.slice(0, 3).map((service, index) => (
                  <Badge key={index} variant="secondary" className="text-xs bg-rose-50 text-rose-700">
                    {service.replace('_', ' ')}
                  </Badge>
                ))}
                {customer.preferred_services.length > 3 && (
                  <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                    +{customer.preferred_services.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          <Button 
            variant="outline" 
            className="w-full mt-2 border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors duration-200"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(customer);
            }}
          >
            View Details
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}